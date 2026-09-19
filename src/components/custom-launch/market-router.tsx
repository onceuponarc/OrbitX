"use client";

import {
  pairLabel,
  QUOTE_ASSETS,
  tokenTicker,
  type MarketsConfig,
} from "@/lib/custom-launch/markets";
import { cn } from "@/lib/utils";

export function MarketRouter({ markets, symbol }: { markets: MarketsConfig; symbol: string }) {
  const nodes = [
    {
      id: markets.primary.quote,
      ticker: QUOTE_ASSETS[markets.primary.quote].ticker,
      role: "Primary" as const,
      pair: pairLabel(symbol, markets.primary.quote),
    },
    ...markets.secondary.map((row) => ({
      id: row.id,
      ticker: row.quote === "other" ? row.customTicker.trim().toUpperCase() || "OTHER" : QUOTE_ASSETS[row.quote].ticker,
      role: "Secondary" as const,
      pair: pairLabel(symbol, row.quote, row.customTicker),
    })),
  ];

  return (
    <section className="ox-console relative overflow-hidden rounded-[1.35rem] p-5">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-gold/0 via-gold/40 to-gold/0 ox-router-pulse" />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Market routing</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">One token, many books</h3>
      <p className="mt-1 text-xs text-white/40">
        Preview of how {tokenTicker(symbol)} can eventually reach multiple markets. Nothing is listed.
      </p>
      <div className="relative mt-6 flex flex-col items-center">
        <div className="rounded-2xl border border-gold/40 bg-gold/10 px-5 py-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Instrument</p>
          <p className="text-xl font-semibold">{tokenTicker(symbol)}</p>
        </div>
        <div className="my-2 h-6 w-px bg-gold/40 ox-router-pulse" />
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node) => (
            <div
              key={node.id}
              className={cn(
                "rounded-2xl border px-4 py-3 text-center transition-all",
                node.role === "Primary"
                  ? "border-gold/50 bg-gold/10 scale-[1.02]"
                  : "border-white/10 bg-black/25 text-white/70",
              )}
            >
              <p className="text-2xl font-semibold text-white">{node.ticker}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{node.role}</p>
              <p className="mt-1 text-xs text-white/45">{node.pair}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
