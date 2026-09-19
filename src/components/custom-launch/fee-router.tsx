"use client";

import type { FeeAllocation } from "@/lib/custom-launch/fees";
import { formatBps } from "@/lib/custom-launch/schema";

export function FeeRouter({ allocations }: { allocations: FeeAllocation[] }) {
  return (
    <section className="ox-console relative overflow-hidden rounded-[1.35rem] p-5">
      <div className="pointer-events-none absolute inset-y-0 left-[18px] w-px bg-gradient-to-b from-gold/0 via-gold/50 to-gold/0 ox-router-pulse" />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Fee routing</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">OrbitX fee router</h3>
      <p className="mt-1 text-xs text-white/40">Signature preview of the intended path. Nothing is routed yet.</p>
      <ol className="relative mt-5 space-y-2 font-mono text-[11px] uppercase tracking-[0.14em]">
        {["Trader", "Custom Launch pool", "Trading fee"].map((node) => (
          <li key={node} className="flex items-center gap-3">
            <span className="size-2 rounded-full bg-gold/70" />
            <span className="text-white/55">{node}</span>
          </li>
        ))}
        <li className="flex items-center gap-3 text-gold">
          <span className="size-2 rounded-full bg-gold" />
          OrbitX fee router
        </li>
      </ol>
      <ul className="relative mt-3 space-y-2">
        {allocations.map((row, index) => (
          <li key={row.id} className="flex items-center gap-3 pl-5">
            <span className="w-4 font-mono text-[10px] text-white/25">
              {index === allocations.length - 1 ? "└" : "├"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{row.label}</span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-gold transition-all duration-500"
                  style={{ width: `${Math.max(4, row.bps / 100)}%` }}
                />
              </span>
            </span>
            <span className="font-mono text-xs tabular-nums text-white/55">{formatBps(row.bps)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
