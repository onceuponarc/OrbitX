import "server-only";

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_MAINNET } from "@onceupon/config/pools";
import { RH } from "@onceupon/config/rh";
import { rhChain } from "@/lib/wallets/rh-client";
import { loadArcNetwork } from "@/lib/arc/env";
import { arcChain } from "@/lib/arc/client";
import { ERC20_ABI } from "@/lib/custom-launch/onchain/abi";
import { orbitxPairedAmount } from "@/lib/custom-launch/orbitx-seed";

const UNISWAP_V2_FACTORY_ABI = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
  {
    type: "function",
    name: "createPair",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

const UNISWAP_V2_ROUTER_ABI = [
  {
    type: "function",
    name: "addLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000";

export function evmSeederKey(): Hex | null {
  const raw = process.env.CUSTOM_LAUNCH_EVM_SEEDER_KEY?.trim();
  if (!raw) return null;
  const hex = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  return /^0x[0-9a-fA-F]{64}$/.test(hex) ? hex : null;
}

export function orbitxEvmQuoteSeedUi(quote: "sol" | "usdc"): string {
  const envName = quote === "usdc" ? "CUSTOM_LAUNCH_USDC_SEED" : "CUSTOM_LAUNCH_EVM_QUOTE_SEED";
  const raw = process.env[envName]?.trim();
  if (raw && Number(raw) > 0) return raw;
  return orbitxPairedAmount("usdc");
}

export function uniswapV2Addresses(chain: "arc" | "robinhood"): { factory: Address; router: Address } | null {
  if (chain === "arc") {
    const factory = (process.env.CUSTOM_LAUNCH_UNISWAP_FACTORY?.trim() || ARC_MAINNET.v2Factory) as Address;
    const router = (process.env.CUSTOM_LAUNCH_UNISWAP_ROUTER?.trim() || ARC_MAINNET.v2Router) as Address;
    if (!/^0x[0-9a-fA-F]{40}$/.test(factory) || !/^0x[0-9a-fA-F]{40}$/.test(router)) return null;
    return { factory, router };
  }
  const factory = process.env.CUSTOM_LAUNCH_UNISWAP_FACTORY_RH?.trim() as Address | undefined;
  const router = process.env.CUSTOM_LAUNCH_UNISWAP_ROUTER_RH?.trim() as Address | undefined;
  if (!factory || !router || !/^0x[0-9a-fA-F]{40}$/.test(factory) || !/^0x[0-9a-fA-F]{40}$/.test(router)) return null;
  return { factory, router };
}

export async function evmSeederClients(chain: "arc" | "robinhood") {
  const key = evmSeederKey();
  if (!key) return null;
  const account = privateKeyToAccount(key);
  if (chain === "robinhood") {
    const wallet = createWalletClient({ account, chain: rhChain, transport: http(RH.rpcUrl) });
    const pub = createPublicClient({ chain: rhChain, transport: http(RH.rpcUrl) });
    return { wallet, pub, address: account.address as Address, rpcUrl: RH.rpcUrl };
  }
  const net = loadArcNetwork();
  if (!net) throw new Error("Arc RPC is not set.");
  const wallet = createWalletClient({ account, chain: arcChain(net), transport: http(net.rpcUrl) });
  const pub = createPublicClient({ chain: arcChain(net), transport: http(net.rpcUrl) });
  return { wallet, pub, address: account.address as Address, rpcUrl: net.rpcUrl };
}

export async function seedUniswapV2Pool(opts: {
  chain: "arc" | "robinhood";
  token: Address;
  quote: Address;
  tokenAmount: bigint;
  quoteAmount: bigint;
  lpRecipient: Address;
}): Promise<{ pair: Address; txHash: Hex } | null> {
  if (opts.tokenAmount <= 0n || opts.quoteAmount <= 0n) return null;
  const venues = uniswapV2Addresses(opts.chain);
  const seeder = await evmSeederClients(opts.chain);
  if (!venues || !seeder) return null;

  const tokenBal = await seeder.pub.readContract({
    address: opts.token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [seeder.address],
  });
  const quoteBal = await seeder.pub.readContract({
    address: opts.quote,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [seeder.address],
  });
  if (tokenBal < opts.tokenAmount || quoteBal < opts.quoteAmount) return null;

  let pair = (await seeder.pub.readContract({
    address: venues.factory,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: "getPair",
    args: [opts.token, opts.quote],
  })) as Address;
  if (!pair || pair.toLowerCase() === ZERO) {
    const hash = await seeder.wallet.writeContract({
      address: venues.factory,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "createPair",
      args: [opts.token, opts.quote],
      chain: seeder.wallet.chain,
      account: seeder.wallet.account,
    });
    const receipt = await seeder.pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Uniswap V2 createPair reverted.");
    pair = (await seeder.pub.readContract({
      address: venues.factory,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "getPair",
      args: [opts.token, opts.quote],
    })) as Address;
  }
  if (!pair || pair.toLowerCase() === ZERO) throw new Error("Uniswap V2 pair was not created.");

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const approveToken = await seeder.wallet.writeContract({
    address: opts.token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [venues.router, opts.tokenAmount],
    chain: seeder.wallet.chain,
    account: seeder.wallet.account,
  });
  const tokenReceipt = await seeder.pub.waitForTransactionReceipt({ hash: approveToken });
  if (tokenReceipt.status !== "success") throw new Error("Uniswap token approve reverted.");
  const approveQuote = await seeder.wallet.writeContract({
    address: opts.quote,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [venues.router, opts.quoteAmount],
    chain: seeder.wallet.chain,
    account: seeder.wallet.account,
  });
  const quoteReceipt = await seeder.pub.waitForTransactionReceipt({ hash: approveQuote });
  if (quoteReceipt.status !== "success") throw new Error("Uniswap quote approve reverted.");

  const hash = await seeder.wallet.writeContract({
    address: venues.router,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "addLiquidity",
    args: [
      opts.token,
      opts.quote,
      opts.tokenAmount,
      opts.quoteAmount,
      (opts.tokenAmount * 95n) / 100n,
      (opts.quoteAmount * 95n) / 100n,
      opts.lpRecipient,
      deadline,
    ],
    chain: seeder.wallet.chain,
    account: seeder.wallet.account,
  });
  const receipt = await seeder.pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Uniswap V2 addLiquidity reverted.");
  return { pair, txHash: hash };
}
