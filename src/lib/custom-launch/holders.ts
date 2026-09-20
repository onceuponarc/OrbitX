import "server-only";

import { createPublicClient, http, type Address } from "viem";
import { solanaConnection } from "@/lib/solana/connection";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ERC20_ABI } from "@/lib/custom-launch/onchain/abi";
import { loadArcNetwork } from "@/lib/arc/env";
import { RH } from "@onceupon/config/rh";
import type { PrintableChain } from "@onceupon/config/solana";

export type HolderRecipient = { address: string; amount: string };

export async function onChainTokenBalance(chain: PrintableChain, token: string, owner: string): Promise<bigint> {
  if (chain === "solana") {
    const conn = solanaConnection();
    const mint = new PublicKey(token);
    const ata = getAssociatedTokenAddressSync(mint, new PublicKey(owner), false, TOKEN_2022_PROGRAM_ID);
    const info = await conn.getTokenAccountBalance(ata).catch(() => null);
    return BigInt(info?.value.amount ?? "0");
  }
  const rpc = chain === "robinhood" ? RH.rpcUrl : loadArcNetwork()?.rpcUrl;
  if (!rpc) throw new Error("No RPC configured to verify holder balances.");
  const pub = createPublicClient({ transport: http(rpc) });
  return pub.readContract({
    address: token as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner as Address],
  });
}

export async function verifyHolderRecipients(input: {
  chain: PrintableChain;
  token: string;
  creator: string;
  proposed: HolderRecipient[];
  minBalance?: bigint;
  excluded?: string[];
}): Promise<HolderRecipient[]> {
  if (!input.proposed.length) throw new Error("Holder distribution requires a verified recipient snapshot.");
  const excluded = new Set(
    [input.creator, ...(input.excluded ?? [])].map((row) => row.toLowerCase()).filter(Boolean),
  );
  const verified: HolderRecipient[] = [];
  for (const row of input.proposed) {
    if (!row.address) throw new Error("Holder recipient is missing an address.");
    if (excluded.has(row.address.toLowerCase())) {
      throw new Error("Creator and excluded wallets cannot receive holder rewards.");
    }
    const amount = BigInt(row.amount || "0");
    if (amount <= 0n) throw new Error("Holder amount must be greater than zero.");
    const balance = await onChainTokenBalance(input.chain, input.token, row.address);
    if (balance <= 0n) throw new Error(`Wallet ${row.address} holds none of this token.`);
    if (input.minBalance && balance < input.minBalance) {
      throw new Error(`Wallet ${row.address} is below the minimum holder balance.`);
    }
    verified.push({ address: row.address, amount: amount.toString() });
  }
  return verified;
}
