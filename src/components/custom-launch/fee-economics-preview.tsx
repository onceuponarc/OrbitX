"use client";

import {
  exampleFeeOnVolume,
  exampleShareOfFees,
  formatUsdEstimate,
  type FeeAllocation,
} from "@/lib/custom-launch/fees";
import { formatBps } from "@/lib/custom-launch/schema";

export function FeeEconomicsPreview({
  tradingFeeBps,
  allocations,
}: {
  tradingFeeBps: number;
  allocations: FeeAllocation[];
}) {
  const pot = 100;
  const trade = 1000;
  const tradeFees = exampleFeeOnVolume(trade, tradingFeeBps);

  return (
    <section className="ox-console rounded-[1.35rem] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Fee economics preview</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">Estimates only</h3>
      <p className="mt-1 text-xs text-white/40">UI math on mock dollars. No trade is priced or executed.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Every $100 of trading fees</p>
          <ul className="mt-2 space-y-1 text-sm">
            {allocations.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>{row.label}</span>
                <span className="tabular-nums text-white/70">{formatUsdEstimate(exampleShareOfFees(pot, row.bps))}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">If a trade is $1,000</p>
          <p className="mt-2 text-sm text-white/70">
            Trading fee {formatBps(tradingFeeBps)} · total fees {formatUsdEstimate(tradeFees)}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {allocations.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>{row.label}</span>
                <span className="tabular-nums text-white/70">
                  {formatUsdEstimate(exampleShareOfFees(tradeFees, row.bps))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
