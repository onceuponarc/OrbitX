"use client";

import { linkedCanonicalPools } from "@/lib/custom-launch/linked-pools";
import type { PrimaryQuoteId } from "@/lib/custom-launch/markets";
import type { PrintableChain } from "@onceupon/config/solana";
import { formatEstimateUsd } from "@/lib/custom-launch/markets";

export function LinkedPools({ chain, quote }: { chain: PrintableChain; quote: PrimaryQuoteId }) {
  const pools = linkedCanonicalPools(chain, quote);
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Real pools linked at launch</p>
      <p className="mt-1 text-sm text-white/50">
        Funded {quote.toUpperCase()} books on live DEXes are attached to this token automatically. Nobody
        deposits LP into them. Graduation later opens this token&apos;s own pool from buyer funds on the curve.
      </p>
      <ul className="mt-4 grid gap-2">
        {pools.map((pool) => (
          <li key={`${pool.chain}:${pool.address}`} className="rounded-2xl border border-white/10 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                {pool.dex} · {pool.label}
              </p>
              <p className="font-mono text-[11px] text-white/45">{formatEstimateUsd(pool.liquidityUsd)} depth</p>
            </div>
            <a
              href={pool.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all font-mono text-[11px] text-gold/80"
            >
              {pool.address}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
