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

export type VanityMint = {
  keypair: Keypair;
  tries: number;
  vanity: boolean;
};
