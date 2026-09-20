import { Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createHash } from "node:crypto";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";

export const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOLANA_WSOL = "So11111111111111111111111111111111111111112";
export const POOL_DEST = "pool";
export const FEE_ROUTER_DEST = "fee-router";

export const VAULT_DESTS = [
  "orbitx",
  "creator",
  "holders",
  "liquidity",
  "buyback",
  "burn",
  "charity",
  "treasury",
  "community",
] as const;

export type VaultDest = (typeof VAULT_DESTS)[number];

/** Protocol-derived vault. Creator desks cannot export this seed. */
export function customLaunchVaultKeypair(launchId: string, dest: string): Keypair {
  const seed = createHash("sha256")
    .update(process.env.EMBEDDED_WALLET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "orbitx")
    .update(":custom-launch-vault:")
    .update(launchId)
    .update(":")
    .update(dest)
    .digest();
  return Keypair.fromSeed(seed);
}

export function customLaunchPoolKeypair(launchId: string): Keypair {
  return customLaunchVaultKeypair(launchId, POOL_DEST);
}

export function customLaunchFeeRouterKeypair(launchId: string): Keypair {
  return customLaunchVaultKeypair(launchId, FEE_ROUTER_DEST);
}

export function quoteMintForDraft(draft: CustomLaunchDraft): PublicKey {
  return new PublicKey(draft.markets.primary.quote === "usdc" ? SOLANA_USDC : SOLANA_WSOL);
}

export function quoteSpec(quote: string | PublicKey) {
  const mint = typeof quote === "string" ? new PublicKey(quote) : quote;
  const isUsdc = mint.toBase58() === SOLANA_USDC;
  const isNative = mint.toBase58() === SOLANA_WSOL;
  return {
    mint,
    program: TOKEN_PROGRAM_ID,
    decimals: isUsdc ? 6 : 9,
    isNative,
    isUsdc,
  };
}
