import "server-only";

import { createPublicClient, http, parseUnits, type Address } from "viem";
import { deskRhWallet } from "@/lib/wallets/rh-client";
import { RH } from "@onceupon/config/rh";

export const PONS_CURVE_ABI = [
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ name: "quoteIn", type: "uint256" }, { name: "minTokensOut", type: "uint256" }, { name: "recipient", type: "address" }], outputs: [{ name: "tokensOut", type: "uint256" }] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ name: "tokensIn", type: "uint256" }, { name: "minQuoteOut", type: "uint256" }, { name: "recipient", type: "address" }], outputs: [{ name: "quoteOut", type: "uint256" }] },
  { type: "function", name: "isNativeQuote", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "getReserves", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "creatorTaxBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const ERC20 = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

function amountOut(input: bigint, reserveIn: bigint, reserveOut: bigint) {
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error("This Pons curve has no liquidity.");
  return input * reserveOut / (reserveIn + input);
}

export async function tradeOnPons(input: { userId: string; token: Address; curve: Address; side: "buy" | "sell"; amountUi: string }) {
  const { wallet, address } = await deskRhWallet(input.userId);
  const pub = createPublicClient({ chain: wallet.chain, transport: http(RH.rpcUrl) });
  const amount = parseUnits(input.amountUi, 18);
  if (amount <= 0n) throw new Error("Trade amount must be greater than zero.");
  const [native, reserves, feeBps, taxBps] = await Promise.all([
    pub.readContract({ address: input.curve, abi: PONS_CURVE_ABI, functionName: "isNativeQuote" }),
    pub.readContract({ address: input.curve, abi: PONS_CURVE_ABI, functionName: "getReserves" }),
    pub.readContract({ address: input.curve, abi: PONS_CURVE_ABI, functionName: "feeBps" }),
    pub.readContract({ address: input.curve, abi: PONS_CURVE_ABI, functionName: "creatorTaxBps" }),
  ]);
  const [quoteReserve, tokenReserve] = reserves as readonly [bigint, bigint];
  const bps = 10000n;
  const fee = feeBps as bigint;
  const tax = taxBps as bigint;
  if (input.side === "buy") {
    const net = amount * (bps - fee - tax) / bps;
    const grossOut = amountOut(net, quoteReserve, tokenReserve);
    const minOut = grossOut * 98n / 100n;
    const request = { address: input.curve, abi: PONS_CURVE_ABI, functionName: "buy" as const, args: [amount, minOut, address] as const, ...(native ? { value: amount } : {}) };
    const { request: simulated } = await pub.simulateContract({ ...request, account: address });
    const hash = await wallet.writeContract(simulated);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Pons buy reverted.");
    return { hash, chainId: RH.chainId, side: input.side, amountIn: amount.toString(), amountOut: grossOut.toString() };
  }
  const balance = await pub.readContract({ address: input.token, abi: ERC20, functionName: "balanceOf", args: [address] });
  if (balance < amount) throw new Error("Insufficient token balance for this sell.");
  const gross = amountOut(amount, tokenReserve, quoteReserve);
  const net = gross * (bps - fee - tax) / bps;
  const minOut = net * 98n / 100n;
  const allowance = await pub.readContract({ address: input.token, abi: ERC20, functionName: "allowance", args: [address, input.curve] });
  if (allowance < amount) {
    const approval = await wallet.writeContract({ address: input.token, abi: ERC20, functionName: "approve", args: [input.curve, amount] });
    await pub.waitForTransactionReceipt({ hash: approval });
  }
  const { request: simulated } = await pub.simulateContract({ address: input.curve, abi: PONS_CURVE_ABI, functionName: "sell", args: [amount, minOut, address], account: address });
  const hash = await wallet.writeContract(simulated);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Pons sell reverted.");
  return { hash, chainId: RH.chainId, side: input.side, amountIn: amount.toString(), amountOut: net.toString() };
}
