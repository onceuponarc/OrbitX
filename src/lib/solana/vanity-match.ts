/**
 * Base58 suffix matching for vanity mints. Kept free of any @solana/web3.js
 * import so the matching rule itself is directly testable.
 *
 * The base58 alphabet has no uppercase "O", no "I", no "l" and no "0" — and it is
 * case-SENSITIVE. Matching case-insensitively (as the original implementation
 * did) accepts addresses that do not actually end in the requested suffix.
 */
export const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const VANITY_SUFFIX = "obx";

/** Whether a suffix can occur in a base58 address at all. */
export function isMintableSuffix(suffix: string) {
  return suffix.length > 0 && [...suffix].every((c) => BASE58_ALPHABET.includes(c));
}

/** Exact, case-sensitive suffix test. */
export function mintEndsWith(address: string, suffix: string = VANITY_SUFFIX) {
  return address.endsWith(suffix);
}

/** Expected keypairs to try for a suffix of this length: 58^len. */
export function expectedAttempts(suffixLength: number) {
  return 58 ** suffixLength;
}
