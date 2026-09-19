import "server-only";

import { LAMPORTS_PER_SOL, type Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { createServiceClient } from "@/lib/supabase/service";
import { SOLANA } from "@onceupon/config/solana";
import { solanaConnection } from "@/lib/solana/connection";
import { encodeSecret, openKeypair } from "@/lib/solana/keys";
import { sealSecret } from "@/lib/crypto/secret-box";
import { packDeskSecret } from "@/lib/wallets/desk-secret";
import { createSolanaDeskWallet } from "@/lib/wallets/mnemonic";

const SOLANA_CAIP = SOLANA.caip2;

export async function ensureSolanaWallet(userId: string): Promise<{ address: string; created: boolean }> {
  const service = createServiceClient();
  const { data: existing } = await service
    .from("wallet_secrets")
    .select("address")
    .eq("user_id", userId)
    .eq("chain", "solana")
    .maybeSingle();

  if (existing?.address) {
    await upsertPublicWallet(userId, existing.address);
    return { address: existing.address, created: false };
  }

  const built = createSolanaDeskWallet();
  const address = built.address;
  const { error } = await service.from("wallet_secrets").insert({
    user_id: userId,
    chain: "solana",
    address,
    ciphertext: sealSecret(packDeskSecret(encodeSecret(built.keypair), built.mnemonic)),
  });
  if (error) throw new Error("Could not store the embedded wallet.");
  await upsertPublicWallet(userId, address);
  return { address, created: true };
}

async function upsertPublicWallet(userId: string, address: string) {
  const service = createServiceClient();
  const { data: existingPrimary } = await service
    .from("user_wallets")
    .select("id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();
  await service.from("user_wallets").upsert(
    {
      user_id: userId,
      chain_caip2: SOLANA_CAIP,
      address,
      is_primary: !existingPrimary,
      kind: "embedded",
      verified_at: new Date().toISOString(),
    },
    { onConflict: "chain_caip2,address" },
  );
  await service
    .from("user_wallets")
    .delete()
    .eq("user_id", userId)
    .eq("address", address)
    .eq("chain_caip2", "solana:devnet");
}

export async function loadUserKeypair(userId: string): Promise<Keypair> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("wallet_secrets")
    .select("ciphertext")
    .eq("user_id", userId)
    .eq("chain", "solana")
    .maybeSingle();
  if (error || !data?.ciphertext) throw new Error("No Solana wallet on this account.");
  return openKeypair(data.ciphertext);
}

export async function exportUserSecret(userId: string): Promise<{
  address: string;
  secretBase58: string;
  secretArray: number[];
}> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("wallet_secrets")
    .select("address, ciphertext")
    .eq("user_id", userId)
    .eq("chain", "solana")
    .maybeSingle();
  if (error || !data?.ciphertext || !data.address) throw new Error("No Solana wallet on this account.");
  const keypair = openKeypair(data.ciphertext);
  return {
    address: data.address,
    secretBase58: bs58.encode(keypair.secretKey),
    secretArray: Array.from(keypair.secretKey),
  };
}

export async function requireSolBalance(address: string, minSol = 0.05): Promise<{ balance: number }> {
  const connection = solanaConnection();
  const { PublicKey } = await import("@solana/web3.js");
  const pubkey = new PublicKey(address);
  const balance = await connection.getBalance(pubkey);
  const min = minSol * LAMPORTS_PER_SOL;
  if (balance < min) {
    throw new Error(
      `Pad wallet needs at least ${minSol} SOL on ${SOLANA.name}. Send SOL to ${address.slice(0, 4)}…${address.slice(-4)}.`,
    );
  }
  return { balance: balance / LAMPORTS_PER_SOL };
}

export async function solBalance(address: string): Promise<number> {
  const { PublicKey } = await import("@solana/web3.js");
  const lamports = await solanaConnection().getBalance(new PublicKey(address));
  return lamports / LAMPORTS_PER_SOL;
}
