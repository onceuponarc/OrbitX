import "server-only";

import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { ARGUS_PORTAL7, ARGUS_PORTAL7_ABI, ARC_USDC } from "@/lib/arc/argus";
import { publicArc, requireArcNetwork } from "@/lib/arc/client";
import { deskEvmWallet } from "@/lib/wallets/sign-desk";

export const ARGUS_UNIVERSAL_ROUTER = "0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1" as Address;
export const ARC_STATE_VIEW = "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b" as Address;
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;

const STATE_VIEW_ABI = [{ type: "function", name: "getSlot0", stateMutability: "view", inputs: [{ name: "poolId", type: "bytes32" }], outputs: [{ name: "sqrtPriceX96", type: "uint160" }, { name: "tick", type: "int24" }, { name: "protocolFee", type: "uint24" }, { name: "lpFee", type: "uint24" }] }] as const;
const ERC20_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
const PERMIT2_ABI = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }], outputs: [] }] as const;
const ROUTER_ABI = [{ type: "function", name: "execute", stateMutability: "payable", inputs: [{ name: "commands", type: "bytes" }, { name: "inputs", type: "bytes[]" }, { name: "deadline", type: "uint256" }], outputs: [] }] as const;

const V4_SWAP = 0x10;
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;
const MAX_UINT160 = (1n << 160n) - 1n;

function poolIdFor(token: Address, hook: Address, quote: Address) {
  const [currency0, currency1] = BigInt(getAddress(quote)) < BigInt(getAddress(token)) ? [quote, token] : [token, quote];
  return keccak256(encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
    [currency0, currency1, 10_000, 200, hook],
  ));
}

function exactInSingle(key: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }, zeroForOne: boolean, amountIn: bigint, minOut: bigint) {
  return encodeAbiParameters(
    [{ type: "tuple", components: [{ name: "poolKey", type: "tuple", components: [{ name: "currency0", type: "address" }, { name: "currency1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" }] }, { name: "zeroForOne", type: "bool" }, { name: "amountIn", type: "uint128" }, { name: "amountOutMinimum", type: "uint128" }, { name: "minHopPriceX36", type: "uint160" }, { name: "hookData", type: "bytes" }] }],
    [{ poolKey: key, zeroForOne, amountIn, amountOutMinimum: minOut, minHopPriceX36: 0n, hookData: "0x" }],
  );
}
function actionsParams(actions: number[], params: Hex[]) {
  return encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [`0x${actions.map((x) => x.toString(16).padStart(2, "0")).join("")}` as Hex, params]);
}
function quoteFromSqrt(sqrt: bigint, tokenIsToken0: boolean, amountIn: bigint, buy: boolean) {
  if (sqrt === 0n) throw new Error("Argus pool has no initialized price or liquidity.");
  const q192 = 1n << 192n;
  const tokenPerQuote = tokenIsToken0 ? (q192 / (sqrt * sqrt)) : ((sqrt * sqrt) / q192);
  if (tokenPerQuote <= 0n) throw new Error("Argus pool quote is below integer precision.");
  const raw = buy ? amountIn * (tokenIsToken0 ? q192 : sqrt * sqrt) / (tokenIsToken0 ? sqrt * sqrt : q192) : amountIn * (tokenIsToken0 ? sqrt * sqrt : q192) / (tokenIsToken0 ? q192 : sqrt * sqrt);
  return raw > 0n ? raw : 1n;
}

async function approvePermit2(pub: PublicClient, wallet: WalletClient, token: Address, owner: Address, amount: bigint) {
  const current = await pub.readContract({ address: token, abi: ERC20_ABI, functionName: "allowance", args: [owner, PERMIT2] });
  if (current < amount) {
    const hash = await wallet.writeContract({ account: owner, chain: undefined, address: token, abi: ERC20_ABI, functionName: "approve", args: [PERMIT2, MAX_UINT160] });
    await pub.waitForTransactionReceipt({ hash });
  }
  const expiration = Math.floor(Date.now() / 1000) + 31_536_000;
  const hash = await wallet.writeContract({ account: owner, chain: undefined, address: PERMIT2, abi: PERMIT2_ABI, functionName: "approve", args: [token, ARGUS_UNIVERSAL_ROUTER, MAX_UINT160, expiration] });
  await pub.waitForTransactionReceipt({ hash });
}

export async function tradeArcV4(input: { userId: string; token: Address; side: "buy" | "sell"; amountUi: string }) {
  const net = requireArcNetwork();
  const pub = publicArc(net);
  const { wallet } = await deskEvmWallet(input.userId);
  const account = wallet.account;
  if (!account) throw new Error("Arc signer is unavailable.");
  const amountIn = parseUnits(input.amountUi, input.side === "buy" ? 6 : 18);
  if (amountIn <= 0n) throw new Error("Trade amount must be greater than zero.");
  const launch = await pub.readContract({ address: ARGUS_PORTAL7, abi: ARGUS_PORTAL7_ABI, functionName: "launches", args: [input.token] });
  const hook = launch[4] as Address;
  const quote = (launch[10] as Address) || ARC_USDC;
  const tokenIsToken0 = Boolean(launch[2]);
  const poolId = poolIdFor(input.token, hook, quote);
  const slot = await pub.readContract({ address: ARC_STATE_VIEW, abi: STATE_VIEW_ABI, functionName: "getSlot0", args: [poolId] });
  const sqrt = slot[0] as bigint;
  const grossOut = quoteFromSqrt(sqrt, tokenIsToken0, amountIn, input.side === "buy");
  const minOut = grossOut * 98n / 100n;
  const [currency0, currency1] = BigInt(getAddress(quote)) < BigInt(getAddress(input.token)) ? [quote, input.token] : [input.token, quote];
  const key = { currency0, currency1, fee: 10_000, tickSpacing: 200, hooks: hook } as const;
  const zeroForOne = input.side === "buy" ? !tokenIsToken0 : tokenIsToken0;
  if (input.side === "sell") await approvePermit2(pub, wallet, input.token, account.address, amountIn);
  else await approvePermit2(pub, wallet, quote, account.address, amountIn);
  const inputCurrency = input.side === "buy" ? quote : input.token;
  const outputCurrency = input.side === "buy" ? input.token : quote;
  const swap = exactInSingle(key, zeroForOne, amountIn, minOut);
  const settle = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [inputCurrency, amountIn]);
  const take = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [outputCurrency, minOut]);
  const v4Input = actionsParams([SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL], [swap, settle, take]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const request = { address: ARGUS_UNIVERSAL_ROUTER, abi: ROUTER_ABI, functionName: "execute" as const, args: [`0x${V4_SWAP.toString(16).padStart(2, "0")}` as Hex, [v4Input], deadline] as const, account: account.address };
  let simulated;
  try { simulated = await pub.simulateContract(request); }
  catch (error) { throw new Error(`Arc ${input.side} simulation failed: ${error instanceof Error ? error.message : String(error)}`); }
  const hash = await wallet.writeContract(simulated.request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Arc ${input.side} reverted: ${hash}`);
  return { hash, poolId, amountIn: amountIn.toString(), amountOut: minOut.toString(), chainId: 5042 };
}
