/** OrbitX-funded Custom Launch quote. Creators size tokens; they do not deposit quote. */

export const ORBITX_POOL_SEED = {
  sol: "0.05",
  usdc: "50",
} as const;

export type OrbitxSeedQuote = keyof typeof ORBITX_POOL_SEED;

export function orbitxPairedAmount(quote: string): string {
  if (quote === "usdc") return ORBITX_POOL_SEED.usdc;
  if (quote === "sol") return ORBITX_POOL_SEED.sol;
  return ORBITX_POOL_SEED.sol;
}

export function isOrbitxSeedQuote(quote: string): quote is OrbitxSeedQuote {
  return quote === "sol" || quote === "usdc";
}
