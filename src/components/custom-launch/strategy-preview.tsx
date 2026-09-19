"use client";

import { composeStrategyPreview, findStrategy, launchModeSummary, type CustomLaunchModeState } from "@/lib/custom-launch/modes";
import { formatBps } from "@/lib/custom-launch/schema";
import { cn } from "@/lib/utils";

export function StrategyPreview({ mode }: { mode: CustomLaunchModeState }) {
  const lanes = composeStrategyPreview(mode);
  const strategy = findStrategy(mode.inspected);

  return (
    <aside className="ox-console rounded-[1.35rem] p-4 lg:sticky lg:top-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Strategy preview</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">{launchModeSummary(mode)}</h3>
      <p className="mt-1 text-xs text-white/40">
        Mock router only. No fees are claimed or moved from this screen.
      </p>

      <ol className="mt-4 space-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">
        <li>Trades</li>
        <li className="pl-3 text-white/30">↓</li>
        <li>Trading fees</li>
        <li className="pl-3 text-white/30">↓</li>
        <li>Automatic claim</li>
        <li className="pl-3 text-white/30">↓</li>
        <li className="text-gold">Fee router</li>
      </ol>

      <ul className="mt-3 space-y-2">
        {lanes.map((lane, index) => (
          <li key={lane.id} className="flex items-center gap-3">
            <span className="w-4 font-mono text-[10px] text-white/25">{index === lanes.length - 1 ? "└" : "├"}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-white">{lane.label}</span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className={cn("block h-full rounded-full bg-gold", strategy?.accent === "arc" && "bg-arc")}
                  style={{ width: `${Math.max(6, lane.bps / 100)}%` }}
                />
              </span>
            </span>
            <span className="font-mono text-xs tabular-nums text-white/60">{formatBps(lane.bps)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
