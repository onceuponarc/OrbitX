import "server-only";

import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  parseEventLogs,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_MAINNET } from "@onceupon/config/arc";
import { RH } from "@onceupon/config/rh";

export type ParNetwork = "arc" | "robinhood";
export type ParFeeMode = "creator" | "holders" | "burn" | "floor";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
// Arc's native USDC predeploy. It is intentionally a valid 20-byte address with a 0x3600… suffix.
// ArcPad primary launcher, documented live on Arc mainnet (chain 5042).
const ARCPAD_CURVE_PAD = "0x24196cd6e534cfce8f480b53e70809b68ea86f29" as Address;
const ARC_USDC = "0x3600000000000000000000000000000000000000" as Address;
const ARC_HOLDER_VAULT = "0x64D085E5269fdAFfc28363f21b208f8A2EfCcD0A" as Address;
const ARC_BURN_VAULT = "0x4067820296a0C717c3e31B05E98505b3215c5544" as Address;
const ARC_FLOOR_VAULT = "0x5567633b002f935181f0fEAa8953Bd0ad5610b0D" as Address;
const RH_MULTI_FACTORY = "0x3ea29975a79900179F3e1aEF93347Ba4210c29C1" as Address;
const RH_MULTI_ROUTER = "0x458D2a59c2F3dd32775a64eE72004561440d64Df" as Address;

const tokenParams = {
  type: "tuple",
  components: [
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "logo", type: "string" },
    { name: "description", type: "string" },
    { name: "socials", type: "tuple", components: [
      { name: "twitter", type: "string" }, { name: "telegram", type: "string" },
      { name: "discord", type: "string" }, { name: "website", type: "string" },
      { name: "farcaster", type: "string" },
    ] },
    { name: "creatorFeeRecipient", type: "address" },
    { name: "creatorTaxBps", type: "uint16" },
    { name: "expectedEconomics", type: "bytes32" },
    { name: "salt", type: "bytes32" },
  ],
} as const;

export const PAR_MULTI_FACTORY_ABI = [
  { type: "function", name: "launchFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nativeIsReference", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "previewLaunchEconomics", stateMutability: "view", inputs: [{ name: "launchConfigId", type: "uint256" }, { name: "pairTokens", type: "address[]" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "launchToken", stateMutability: "payable", inputs: [tokenParams, { name: "launchConfigId", type: "uint256" }, { name: "pairTokens", type: "address[]" }], outputs: [{ name: "token", type: "address" }] },
] as const;

export const PAR_MULTI_ROUTER_ABI = [
  { type: "function", name: "launchAndBuyWithReference", stateMutability: "payable", inputs: [tokenParams, { name: "launchConfigId", type: "uint256" }, { name: "pairTokens", type: "address[]" }, { name: "legs", type: "tuple[]" }, { name: "amountIn", type: "uint256" }, { name: "minTokensOut", type: "uint256" }], outputs: [{ name: "token", type: "address" }, { name: "tokensOut", type: "uint256" }] },
] as const;

export const ARCPAD_ABI = [
  { type: "function", name: "createToken", stateMutability: "payable", inputs: [
    { name: "name", type: "string" }, { name: "symbol", type: "string" },
    { name: "meta", type: "tuple", components: [
      { name: "imageURI", type: "string" }, { name: "website", type: "string" },
      { name: "twitter", type: "string" }, { name: "telegram", type: "string" },
    ] }, { name: "salt", type: "bytes32" },
  ], outputs: [] },
  { type: "event", name: "TokenCreated", anonymous: false, inputs: [
    { name: "token", type: "address", indexed: true },
    { name: "creator", type: "address", indexed: true },
    { name: "name", type: "string", indexed: false },
    { name: "symbol", type: "string", indexed: false },
    { name: "pool", type: "address", indexed: false },
    { name: "imageURI", type: "string", indexed: false },
    { name: "website", type: "string", indexed: false },
    { name: "twitter", type: "string", indexed: false },
    { name: "telegram", type: "string", indexed: false },
  ] },
] as const;

export async function launchWithArcPad(input: {
  name: string; symbol: string; logo?: string; description?: string;
  twitter?: string; telegram?: string; website?: string; creator: Address;
  wallet: WalletClient; pub: PublicClient; devBuy?: bigint;
}) {
  const salt = `0x${Buffer.from(`${input.creator}:${input.name}:${input.symbol}:${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
  const value = input.devBuy ?? 0n;
  const { request } = await input.pub.simulateContract({
    address: ARCPAD_CURVE_PAD, abi: ARCPAD_ABI, functionName: "createToken",
    args: [input.name.slice(0, 64), input.symbol.toUpperCase().slice(0, 16), {
      imageURI: input.logo || "", website: input.website || "", twitter: input.twitter || "", telegram: input.telegram || "",
    }, salt], account: input.wallet.account, value, gas: 3_000_000n,
  });
  const hash = await input.wallet.writeContract(request);
  const receipt = await input.pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("ArcPad launch reverted. No token was created.");
  const events = parseEventLogs({ abi: ARCPAD_ABI, logs: receipt.logs, eventName: "TokenCreated" });
  const token = events[0]?.args.token as Address | undefined;
  if (!token) throw new Error("ArcPad launch confirmed, but the token address was not found in the confirmation event.");
  return { hash, token, factory: ARCPAD_CURVE_PAD, router: null, pairTokens: [ARC_USDC], venue: "arcpad", launchFee: value.toString(), explorer: `https://www.arcexplorer.org/tx/${hash}` };
}

function chainFor(network: ParNetwork): Chain {
  if (network === "robinhood") return {
    id: RH.chainId, name: RH.name, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RH.rpcUrl] } }, blockExplorers: { default: { name: "Blockscout", url: RH.explorer } },
  };
  if (process.env.ARC_CHAIN_ID && process.env.ARC_CHAIN_ID !== "5042") throw new Error("Par Arc launch is mainnet-only (chain 5042).");
  return {
    id: 5042, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io", "https://rpc.arc-scan.org", "https://arc-mainnet.infura.io/v3/b6bf7d3508c941499b10025c0776eaf8"] } },
    blockExplorers: { default: { name: "Arc Explorer", url: "https://www.arcexplorer.org" } },
  };
}

export function parAddresses(network: ParNetwork) {
  if (network === "robinhood") return { factory: RH_MULTI_FACTORY, router: RH_MULTI_ROUTER, defaultPairToken: ZERO, feeRecipients: {} as Record<ParFeeMode, Address> };
  return {
    factory: ARCPAD_CURVE_PAD, router: ZERO, defaultPairToken: ARC_USDC,
    feeRecipients: { creator: ZERO, holders: ARC_HOLDER_VAULT, burn: ARC_BURN_VAULT, floor: ARC_FLOOR_VAULT } satisfies Record<ParFeeMode, Address>,
  };
}

function walletFor(network: ParNetwork): WalletClient {
  const secret = network === "robinhood" ? process.env.RH_LAUNCH_PRIVATE_KEY : process.env.ARC_LAUNCH_PRIVATE_KEY;
  if (!secret) throw new Error(`${network} Par launch signer is not configured.`);
  const account = privateKeyToAccount((secret.startsWith("0x") ? secret : `0x${secret}`) as `0x${string}`);
  return createWalletClient({ account, chain: chainFor(network), transport: http() });
}
function publicFor(network: ParNetwork): PublicClient { return createPublicClient({ chain: chainFor(network), transport: http() }); }

export async function launchWithPar(input: {
  network: ParNetwork; name: string; symbol: string; logo?: string; description: string;
  twitter?: string; telegram?: string; website?: string; creator: Address; creatorTaxBps?: number;
  pairTokens?: Address[]; feeMode?: ParFeeMode; wallet?: WalletClient; pub?: PublicClient;
}) {
  const wallet = input.wallet ?? walletFor(input.network);
  const pub = input.pub ?? publicFor(input.network);
  const addresses = parAddresses(input.network);
  const pairTokens = input.pairTokens?.length ? input.pairTokens : [addresses.defaultPairToken];
  if (pairTokens.length < 1 || pairTokens.length > 5) throw new Error("Choose between 1 and 5 quote assets.");
  const unique = new Set(pairTokens.map((x) => x.toLowerCase()));
  if (unique.size !== pairTokens.length) throw new Error("Quote assets must be unique.");
  if (input.network === "arc" && pairTokens.some((x) => x.toLowerCase() === ZERO.toLowerCase())) throw new Error("Arc uses the USDC reference asset; native address(0) is not a valid Arc quote.");
  const mode = input.feeMode ?? "creator";
  const recipient = mode === "creator" ? input.creator : addresses.feeRecipients[mode];
  if (!recipient) throw new Error(`Fee mode ${mode} is not configured for ${input.network}.`);
  const launchFee = await pub.readContract({ address: addresses.factory, abi: PAR_MULTI_FACTORY_ABI, functionName: "launchFee" });
  // Arc uses native USDC for both gas and payable protocol fees. Fail before
  // simulateContract when the desk wallet cannot cover the required value;
  // otherwise the RPC only reports the opaque OutOfFunds error.
  const signerAddress = wallet.account?.address;
  if (!signerAddress) throw new Error("Arc launch signer is unavailable.");
  const nativeBalance = await pub.getBalance({ address: signerAddress });
  if (nativeBalance < launchFee) {
    throw new Error(`Insufficient Arc USDC balance: launch requires ${launchFee.toString()} base units plus gas, but the launch wallet has ${nativeBalance.toString()}. Fund the signing wallet, then retry.`);
  }
  // Pool-priced quote assets can move between preview and inclusion. Par requires
  // a zero digest for those; only the fixed Arc USDC reference is pinned here.
  const expectedEconomics = pairTokens.every((token) => token.toLowerCase() === ARC_USDC.toLowerCase())
    ? await pub.readContract({ address: addresses.factory, abi: PAR_MULTI_FACTORY_ABI, functionName: "previewLaunchEconomics", args: [0n, pairTokens] })
    : "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
  const salt = `0x${Buffer.from(`${input.creator}:${input.name}:${input.symbol}:${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
  const params = {
    name: input.name.slice(0, 32), symbol: input.symbol.toUpperCase().slice(0, 10), logo: input.logo || "",
    description: input.description || "Launched on OrbitX",
    socials: { twitter: input.twitter || "", telegram: input.telegram || "", discord: "", website: input.website || "", farcaster: "" },
    creatorFeeRecipient: recipient, creatorTaxBps: Math.max(0, Math.min(1000, input.creatorTaxBps ?? 100)), expectedEconomics, salt,
  } as const;
  const { request, result } = await pub.simulateContract({ address: addresses.factory, abi: PAR_MULTI_FACTORY_ABI, functionName: "launchToken", args: [params, 0n, pairTokens], account: wallet.account, value: launchFee });
  const hash = await wallet.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Par launch reverted.");
  const token = (result as Address) || null;
  return { hash, token, factory: addresses.factory, router: addresses.router, pairTokens, feeMode: mode, creatorFeeRecipient: recipient, launchFee: launchFee.toString(), explorer: `${chainFor(input.network).blockExplorers?.default.url}/tx/${hash}` };
}
