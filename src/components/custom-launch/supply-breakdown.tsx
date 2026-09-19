"use client";

import { Input } from "@/components/ui/input";
import { formatBps } from "@/lib/custom-launch/schema";
import { formatSupply } from "@/lib/custom-launch/token";
import {
  supplyAllocatedBps,
  supplyRemainingBps,
  unitsForShare,
  type SupplyAllocation,
  type SupplyPlan,
} from "@/lib/custom-launch/supply";
import { cn } from "@/lib/utils";

const TONES = ["bg-gold", "bg-arc", "bg-buy", "bg-heat", "bg-teal", "bg-burgundy", "bg-white/40"];

export function SupplyBreakdown({
  supply,
  plan,
  onChange,
}: {
  supply: string;
  plan: SupplyPlan;
  onChange: (allocations: SupplyAllocation[]) => void;
}) {
  const allocated = supplyAllocatedBps(plan);
  const remaining = supplyRemainingBps(plan);
  const over = allocated > 10_000;

  return (
    <section className="ox-console rounded-[1.35rem] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Supply breakdown</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">How the print is carved</h3>
          <p className="mt-1 text-xs text-white/45">
            Mock rows only. These allocations are not minted or locked from this screen.
          </p>
        </div>
        <p className={cn("font-mono text-[11px] uppercase tracking-[0.14em]", over ? "text-heat" : remaining ? "text-gold" : "text-buy")}>
          {over ? `Over by ${formatBps(allocated - 10_000)}` : remaining ? `${formatBps(remaining)} remaining` : "100%"}
        </p>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10">
        {plan.allocations.map((row, index) =>
          row.bps ? (
            <span
              key={row.id}
              className={cn("h-full transition-all", TONES[index % TONES.length])}
              style={{ width: `${Math.min(100, row.bps / 100)}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {plan.allocations.map((row, index) => (
          <li key={row.id} className="grid grid-cols-[1fr_88px_1fr] items-center gap-3">
            <span className="flex items-center gap-2 text-sm">
              <span className={cn("size-2 rounded-full", TONES[index % TONES.length])} />
              {row.label}
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={(row.bps / 100).toString()}
              onChange={(event) => {
                const pct = Number(event.target.value);
                const bps = Number.isFinite(pct) ? Math.round(Math.max(0, Math.min(100, pct)) * 100) : 0;
                onChange(plan.allocations.map((item) => (item.id === row.id ? { ...item, bps } : item)));
              }}
            />
            <span className="text-right text-xs tabular-nums text-white/45">
              {formatBps(row.bps)} · {formatSupply(String(unitsForShare(supply, row.bps)))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
