import { generateKeyPairSync } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { mintEndsWith, VanityTimeoutError, VANITY_SUFFIX, type VanityMint } from "./vanity.ts";

/** Leave headroom inside the 60s Solana launch route for pump.fun + RPC. */
export const VANITY_MINE_BUDGET_MS = 32_000;
const BATCH = 250;

function grindOnce(suffix: string): { keypair: Keypair } | null {
  const pair = generateKeyPairSync("ed25519");
  const pub = Uint8Array.from(pair.publicKey.export({ type: "spki", format: "der" }).subarray(-32));
  if (!mintEndsWith(bs58.encode(pub), suffix)) return null;
  const seed = Uint8Array.from(pair.privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32));
  const secret = new Uint8Array(64);
  secret.set(seed, 0);
  secret.set(pub, 32);
  return { keypair: Keypair.fromSecretKey(secret, { skipValidation: true }) };
}

function yieldEventLoop() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

export function vanityMintFromSecret(secretBase64: string, suffix = VANITY_SUFFIX): VanityMint | null {
  try {
    const secret = Uint8Array.from(Buffer.from(secretBase64, "base64"));
    if (secret.byteLength !== 64) return null;
    const keypair = Keypair.fromSecretKey(secret);
    if (!mintEndsWith(keypair.publicKey.toBase58(), suffix)) return null;
    return { keypair, tries: 0, vanity: true };
  } catch {
    return null;
  }
}

export async function generateVanityMint(
  suffix = VANITY_SUFFIX,
  budgetMs = VANITY_MINE_BUDGET_MS,
): Promise<VanityMint> {
  const deadline = Date.now() + budgetMs;
  let tries = 0;
  while (Date.now() < deadline) {
    for (let i = 0; i < BATCH; i++) {
      tries += 1;
      const hit = grindOnce(suffix);
      if (hit) return { keypair: hit.keypair, tries, vanity: true };
      if (Date.now() >= deadline) break;
    }
    await yieldEventLoop();
  }
  return { keypair: Keypair.generate(), tries, vanity: false };
}

/** Strict production resolver: never silently substitutes a non-vanity mint. */
export async function resolveLaunchMint(
  required = true,
  suffix = VANITY_SUFFIX,
  budgetMs = VANITY_MINE_BUDGET_MS,
): Promise<VanityMint> {
  if (!required) return { keypair: Keypair.generate(), tries: 1, vanity: false };
  const minted = await generateVanityMint(suffix, budgetMs);
  if (!minted.vanity) throw new VanityTimeoutError(suffix, minted.tries);
  return minted;
}
