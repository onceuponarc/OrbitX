import "server-only";

import { createPublicClient, http, parseUnits, type Address } from "viem";
import { deskEvmWallet } from "@/lib/wallets/sign-desk";
import { ARC_USDC } from "@/lib/arc/arcpad";
import { loadArcNetwork } from "@/lib/arc/env";

export const ARC_SWAP_ROUTER = "0x53bf6b0684ec7ef91e1387da3d1a1769bc5a6f77" as Address;
const FEE = 10_000;
const erc20 = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
const routerAbi = [{ type: "function", name: "exactInputSingle", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [{ name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "fee", type: "uint24" }, { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" }, { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" }, { name: "sqrtPriceLimitX96", type: "uint160" }] }], outputs: [{ type: "uint256" }] }] as const;

export async function tradeOnArcPad(input: { userId: string; token: Address; side: "buy" | "sell"; amountUi: string }) {
  const net = loadArcNetwork();
  if (!net || net.chainId !== 5042) throw new Error("Arc mainnet is not configured for trading.");
  const { wallet, address } = await deskEvmWallet(input.userId);
  const pub = createPublicClient({ chain: wallet.chain, transport: http(net.rpcUrl) });
  const amount = parseUnits(input.amountUi, input.side === "buy" ? 6 : 18);
  if (amount <= 0n) throw new Error("Trade amount must be greater than zero.");
  const tokenIn = input.side === "buy" ? ARC_USDC : input.token;
  const tokenOut = input.side === "buy" ? input.token : ARC_USDC;
  const allowance = await pub.readContract({ address: tokenIn, abi: erc20, functionName: "allowance", args: [address, ARC_SWAP_ROUTER] });
  if (allowance < amount) {
    const approval = await wallet.writeContract({ address: tokenIn, abi: erc20, functionName: "approve", args: [ARC_SWAP_ROUTER, amount] });
    await pub.waitForTransactionReceipt({ hash: approval });
  }
  const params = { tokenIn, tokenOut, fee: FEE, recipient: address, deadline: BigInt(Math.floor(Date.now() / 1000) + 300), amountIn: amount, amountOutMinimum: 1n, sqrtPriceLimitX96: 0n } as const;
  const { request } = await pub.simulateContract({ address: ARC_SWAP_ROUTER, abi: routerAbi, functionName: "exactInputSingle", args: [params], account: address, ...(input.side === "buy" ? { value: 0n } : {}) });
  const hash = await wallet.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Arc swap reverted.");
  return { hash, side: input.side, amountIn: amount.toString(), chainId: 5042, router: ARC_SWAP_ROUTER };
}
