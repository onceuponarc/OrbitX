"use client";

import { ModeIcon } from "@/components/custom-launch/mode-icon";
import { modeAccent } from "@/components/custom-launch/mode-accent";
import { findStrategy, selectedStrategyIds, type CustomLaunchModeState } from "@/lib/custom-launch/modes";
import { cn } from "@/lib/utils";

export function ModeStack({
  mode,
  onInspect,
}: {
  mode: CustomLaunchModeState;
  onInspect: (id: CustomLaunchModeState["primary"]) => void;
}) {
  const ids = selectedStrategyIds(mode);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Selected</p>
      {ids.map((id, index) => {
        const strategy = findStrategy(id);
        if (!strategy) return null;
        const accent = modeAccent(strategy);
        return (
          <button
            key={`${id}-${index}`}
            type="button"
            onClick={() => onInspect(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
              id === mode.primary ? accent.chip : "border-white/12 text-white/60",
              id === mode.inspected && "ring-1 ring-white/30",
            )}
          >
            <ModeIcon id={id} className="size-3" />
            {index > 0 ? <span className="text-white/35">+</span> : null}
            {strategy.name}
          </button>
        );
      })}
    </div>
  );
}
