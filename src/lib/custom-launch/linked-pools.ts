import { CHAIN_POOLS, canonicalPoolsForQuote, type CanonicalPool } from "@onceupon/config/pools";
import type { PrintableChain } from "@onceupon/config/solana";
import type { PrimaryQuoteId } from "@/lib/custom-launch/markets";

export type LinkedDexPool = {
  dex: string;
  address: string;
  label: string;
  quoteId: string;
  liquidityUsd: number;
  url: string;
  chain: PrintableChain;
};

function asLinked(chain: PrintableChain, pool: CanonicalPool): LinkedDexPool {
  return {
    dex: pool.dex,
    address: pool.address,
    label: pool.label,
    quoteId: pool.quoteId,
    liquidityUsd: pool.liquidityUsd,
    url: pool.url,
    chain,
  };
}

/** Real funded quote books linked to a Custom Launch token. Never writes `stories`. */
export function linkedCanonicalPools(chain: PrintableChain, quote: PrimaryQuoteId): LinkedDexPool[] {
  const seen = new Set<string>();
  const out: LinkedDexPool[] = [];
  const push = (pool: LinkedDexPool) => {
    const key = `${pool.chain}:${pool.address.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(pool);
  };

  if (chain === "solana") {
    for (const pool of canonicalPoolsForQuote(quote)) push(asLinked("solana", pool));
    if (!out.length) {
      for (const pool of CHAIN_POOLS.solana.canonicalPools.filter((row) => row.quoteId === "sol" || row.quoteId === "usdc")) {
        push(asLinked("solana", pool));
      }
    }
    return out.slice(0, 3);
  }

  const catalog = CHAIN_POOLS[chain];
  const matching = catalog.canonicalPools.filter((pool) => pool.quoteId === quote || pool.quoteId === "usdc");
  for (const pool of matching.length ? matching : catalog.canonicalPools) {
    push(asLinked(chain, pool));
  }
  return out.slice(0, 3);
}
