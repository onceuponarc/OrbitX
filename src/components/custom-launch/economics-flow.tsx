"use client";

import { useState } from "react";
import { feeAllocatedBps, feeRemainingBps, type FeeAllocation } from "@/lib/custom-launch/fees";
import { allocationDestination } from "@/lib/custom-launch/review";
import { formatBps } from "@/lib/custom-launch/schema";
import { cn } from "@/lib/utils";

export function EconomicsFlow({
  tradingFeeBps,
  allocations,
}: {
  tradingFeeBps: number;
  allocations: FeeAllocation[];
}) {
  const [open, setOpen] = useState<string | null>(allocations[0]?.id ?? null);
  const allocated = feeAllocatedBps(allocations);
  const remaining = feeRemainingBps(allocations);
  const selected = allocations.find((row) => row.id === open);

  return (
    <section className="ox-console relative overflow-hidden rounded-[1.35rem] p-5">
      <div className="pointer-events-none absolute inset-y-0 left-[18px] w-px bg-gradient-to-b from-gold/0 via-gold/50 to-gold/0 ox-router-pulse" />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Economics visualization</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">Fee router</h3>
      <p className="mt-1 text-xs text-white/40">Click a lane for destination and share. Nothing is routed yet.</p>
      <ol className="relative mt-5 space-y-2 font-mono text-[11px] uppercase tracking-[0.14em]">
        {["Trades", "Trading fee", "Fee router"].map((node) => (
          <li key={node} className="flex items-center gap-3 text-white/55">
            <span className="size-2 rounded-full bg-gold/70" />
            {node}
          </li>
        ))}
      </ol>
      <ul className="relative mt-3 space-y-2">
        {allocations.map((row, index) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setOpen(row.id === open ? null : row.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors",
                open === row.id ? "border-gold/40 bg-gold/8" : "border-white/10 hover:border-white/25",
              )}
            >
              <span className="w-4 font-mono text-[10px] text-white/25">
                {index === allocations.length - 1 ? "└" : "├"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{row.label}</span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-gold transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(4, row.bps / 100))}%` }}
                  />
                </span>
              </span>
              <span className="font-mono text-xs tabular-nums text-white/55">{formatBps(row.bps)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Total fee" value={formatBps(tradingFeeBps)} />
        <Stat label="Allocated" value={formatBps(allocated)} warn={allocated !== 10_000} />
        <Stat label="Unallocated" value={formatBps(remaining)} warn={remaining !== 0} />
      </div>
      {allocated !== 10_000 ? (
        <p className="mt-3 text-sm text-heat">Fee allocation does not equal 100%. Fix Trading Economics before deploy.</p>
      ) : null}
      {selected ? (
        <div className="mt-3 rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">{selected.label}</p>
          <p className="mt-1 text-sm text-white/75">
            {formatBps(selected.bps)} of every trading fee
            {selected.locked ? " · locked OrbitX protocol share" : ""}.
          </p>
          <p className="mt-2 break-all font-mono text-xs text-white/50">{allocationDestination(selected.id)}</p>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", warn && "text-heat")}>{value}</p>
    </div>
  );
}
