"use client";

import { Input } from "@/components/ui/input";
import { FEE_DESTINATIONS, type FeeAllocation } from "@/lib/custom-launch/fees";
import { formatBps } from "@/lib/custom-launch/schema";
import { cn } from "@/lib/utils";

export function FeeAllocationBuilder({
  allocations,
  onChange,
}: {
  allocations: FeeAllocation[];
  onChange: (id: FeeAllocation["id"], bps: number) => void;
}) {
  const allocated = allocations.reduce((sum, row) => sum + row.bps, 0);
  const remaining = 10_000 - allocated;
  const over = remaining < 0;

  return (
    <section className="ox-console rounded-[1.35rem] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Fee distribution</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Split the fee pot</h3>
          <p className="mt-1 text-xs text-white/45">
            Destinations follow the selected Launch Mode. OrbitX stays locked.
          </p>
        </div>
        <div className="text-right font-mono text-[11px] uppercase tracking-[0.14em]">
          <p className={over ? "text-heat" : "text-white/70"}>Allocated {formatBps(allocated)}</p>
          <p className={over ? "text-heat" : remaining ? "text-gold" : "text-buy"}>
            Remaining {formatBps(remaining)}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {allocations.map((row) => (
          <li
            key={row.id}
            className={cn(
              "grid grid-cols-[1fr_88px_64px] items-center gap-3 rounded-2xl border px-3 py-2",
              row.locked ? "border-gold/20 bg-gold/5" : "border-white/10",
            )}
          >
            <span>
              <span className="block text-sm font-medium">{row.label}</span>
              <span className="text-[11px] text-white/40">{FEE_DESTINATIONS[row.id].hint}</span>
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={row.locked}
              value={(row.bps / 100).toString()}
              onChange={(event) => {
                const pct = Number(event.target.value);
                onChange(row.id, Number.isFinite(pct) ? Math.round(Math.max(0, Math.min(100, pct)) * 100) : 0);
              }}
            />
            <span className="text-right font-mono text-xs text-white/50">{formatBps(row.bps)}</span>
          </li>
        ))}
      </ul>
      {over ? (
        <p className="mt-3 rounded-2xl border border-heat/30 bg-heat/10 px-3 py-2 text-sm text-heat">
          Allocation is over 100%. Bring the split back to 100% before continuing.
        </p>
      ) : null}
    </section>
  );
}
