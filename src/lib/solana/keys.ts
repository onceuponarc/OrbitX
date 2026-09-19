import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { createHash } from "node:crypto";
import { openSecret, sealSecret } from "@/lib/crypto/secret-box";
import { unpackDeskSecret } from "@/lib/wallets/desk-secret";

export function generateKeypair(): Keypair {
  return Keypair.generate();
}

export function encodeSecret(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

export function decodeSecret(secret: string): Keypair {
  if (secret.startsWith("[")) {
    const nums = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(nums));
  }
  return Keypair.fromSecretKey(bs58.decode(secret));
}

export function sealKeypair(keypair: Keypair): string {
  return sealSecret(encodeSecret(keypair));
}

export function openKeypair(ciphertext: string): Keypair {
  return decodeSecret(unpackDeskSecret(openSecret(ciphertext)).secret);
}

export function protocolKeypair(): Keypair {
  const seed = createHash("sha256")
    .update(process.env.EMBEDDED_WALLET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "orbitx")
    .update(":solana-protocol")
    .digest();
  return Keypair.fromSeed(seed);
}
