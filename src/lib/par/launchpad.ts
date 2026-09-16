import "server-only";

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_MAINNET } from "@onceupon/config/arc";
import { ARC_V4 } from "@onceupon/config/ubi-v4";
import { RH } from "@onceupon/config/rh";

export type ParNetwork = "arc" | "robinhood";

const RH_MULTI_FACTORY = "0x3ea29975a79900179F3e1aEF93347Ba4210c29C1" as Address;
const RH_MULTI_ROUTER = "0x458D2a59c2F3dd32775a64eE72004561440d64Df" as Address;
const ARC_MULTI_FACTORY_MAINNET = ARC_V4.flaunchZap as Address;
const ARC_MULTI_ROUTER_MAINNET = ARC_V4.flaunch as Address;

const tokenParams = {
  type: "tuple",
  components: [
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "logo", type: "string" },
    { name: "description", type: "string" },
    {
      name: "socials",
      type: "tuple",
      components: [
        { name: "twitter", type: "string" },
        { name: "telegram", type: "string" },
        { name: "discord", type: "string" },
        { name: "website", type: "string" },
        { name: "farcaster", type: "string" },
      ],
    },
    { name: "creatorFeeRecipient", type: "address" },
    { name: "creatorTaxBps", type: "uint16" },
    { name: "expectedEconomics", type: "bytes32" },
    { name: "salt", type: "bytes32" },
  ],
} as const;

export const PAR_MULTI_FACTORY_ABI = [
  {
    type: "function",
    name: "launchFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "weth",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "launchToken",
    stateMutability: "payable",
    inputs: [tokenParams, { name: "launchConfigId", type: "uint256" }, { name: "pairTokens", type: "address[]" }],
    outputs: [{ name: "token", type: "address" }],
  },
] as const;

function chainFor(network: ParNetwork): Chain {
  if (network === "robinhood") {
    return {
      id: RH.chainId,
      name: RH.name,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RH.rpcUrl] } },
      blockExplorers: { default: { name: "Blockscout", url: RH.explorer } },
    };
  }
  if (process.env.ARC_CHAIN_ID !== String(ARC_MAINNET.chainId)) {
    throw new Error("Par Arc mainnet is not configured. Refusing to launch on Arc testnet.");
  }
  return {
    id: ARC_MAINNET.chainId,
    name: ARC_MAINNET.name,
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: [process.env.ARC_RPC_URL || ARC_MAINNET.rpcUrls[0]] } },
    blockExplorers: { default: { name: "Arcscan", url: ARC_MAINNET.explorer } },
  };
}

export function parAddresses(network: ParNetwork) {
  // Par's multi factory uses native ETH as the RH reference asset; address(0)
  // is the correct pair token there. Arc uses the USDC ERC-20 reference.
  if (network === "robinhood") return { factory: RH_MULTI_FACTORY, router: RH_MULTI_ROUTER, pairToken: "0x0000000000000000000000000000000000000000" as Address };
  return {
    factory: (process.env.PAR_ARC_MULTI_FACTORY || ARC_MULTI_FACTORY_MAINNET) as Address,
    router: (process.env.PAR_ARC_MULTI_ROUTER || ARC_MULTI_ROUTER_MAINNET) as Address,
    pairToken: (process.env.PAR_ARC_USDC || ARC_MAINNET.usdcErc20) as Address,
  };
}

function walletFor(network: ParNetwork): WalletClient {
  const secret = network === "robinhood" ? process.env.RH_LAUNCH_PRIVATE_KEY : process.env.ARC_LAUNCH_PRIVATE_KEY;
  if (!secret) throw new Error(`${network} Par launch signer is not configured.`);
  const account = privateKeyToAccount((secret.startsWith("0x") ? secret : `0x${secret}`) as `0x${string}`);
  return createWalletClient({ account, chain: chainFor(network), transport: http() });
}

function publicFor(network: ParNetwork): PublicClient {
  return createPublicClient({ chain: chainFor(network), transport: http() });
}

export async function launchWithPar(input: {
  network: ParNetwork;
  name: string;
  symbol: string;
  logo?: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  creator: Address;
  creatorTaxBps?: number;
  wallet?: WalletClient;
  pub?: PublicClient;
}) {
  const wallet = input.wallet ?? walletFor(input.network);
  const pub = input.pub ?? publicFor(input.network);
  const { factory, pairToken } = parAddresses(input.network);
  const launchFee = await pub.readContract({ address: factory, abi: PAR_MULTI_FACTORY_ABI, functionName: "launchFee" });
  const salt = `0x${Buffer.from(`${input.creator}:${input.name}:${input.symbol}:${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
  const params = {
    name: input.name.slice(0, 32),
    symbol: input.symbol.toUpperCase().slice(0, 10),
    logo: input.logo || "",
    description: input.description || "Launched on OrbitX",
    socials: { twitter: input.twitter || "", telegram: input.telegram || "", discord: "", website: input.website || "", farcaster: "" },
    creatorFeeRecipient: input.creator,
    creatorTaxBps: input.creatorTaxBps ?? 0,
    expectedEconomics: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
    salt,
  } as const;
  const { request, result } = await pub.simulateContract({
    address: factory,
    abi: PAR_MULTI_FACTORY_ABI,
    functionName: "launchToken",
    args: [params, 0n, [pairToken]],
    account: wallet.account,
    value: launchFee,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Par launch reverted.");
  const token = (result as Address) || null;
  return { hash, token, factory, pairToken, launchFee: launchFee.toString(), explorer: `${chainFor(input.network).blockExplorers?.default.url}/tx/${hash}` };
}
