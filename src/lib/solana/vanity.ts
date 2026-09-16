import { Keypair } from "@solana/web3.js";

export const VANITY_SUFFIX = "obx";

export class VanityTimeoutError extends Error {
  readonly suffix: string;
  readonly tries: number;

  constructor(suffix: string, tries: number) {
    super(`Could not find a Solana mint ending in ${suffix} before the mining window expired.`);
    this.name = "VanityTimeoutError";
    this.suffix = suffix;
    this.tries = tries;
  }
}

export function mintEndsWith(address: string, suffix = VANITY_SUFFIX) {
  return address.endsWith(suffix);
}

export function generateVanityMint(suffix = VANITY_SUFFIX, budgetMs = 8_000) {
  const start = Date.now();
  let tries = 0;
  while (Date.now() - start < budgetMs) {
    const keypair = Keypair.generate();
    tries += 1;
    if (mintEndsWith(keypair.publicKey.toBase58(), suffix)) {
      return { keypair, tries, vanity: true as const };
    }
  }
  return { keypair: Keypair.generate(), tries, vanity: false as const };
}

/** Strict production resolver: never silently substitutes a non-vanity mint. */
export function resolveLaunchMint(required = true, suffix = VANITY_SUFFIX, budgetMs = 8_000) {
  const minted = generateVanityMint(suffix, budgetMs);
  if (required && !minted.vanity) throw new VanityTimeoutError(suffix, minted.tries);
  return minted;
}
