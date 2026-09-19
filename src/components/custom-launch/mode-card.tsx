"use client";

import { ModeIcon } from "@/components/custom-launch/mode-icon";
import { modeAccent, modeCardClass } from "@/components/custom-launch/mode-accent";
import type { LaunchStrategy, LaunchStrategyId } from "@/lib/custom-launch/modes";
import { cn } from "@/lib/utils";

export function ModeCard({
  strategy,
  state,
  onInspect,
  onPrimary,
  onToggleModule,
}: {
  strategy: LaunchStrategy;
  state: "idle" | "primary" | "module" | "inspect";
  onInspect: (id: LaunchStrategyId) => void;
  onPrimary: (id: LaunchStrategyId) => void;
  onToggleModule: (id: LaunchStrategyId) => void;
}) {
  const accent = modeAccent(strategy);
  const selected = state === "primary" || state === "module";

  return (
    <article
      className={cn(modeCardClass(strategy, state), strategy.advanced && "sm:col-span-2 xl:col-span-3")}
    >
      <button type="button" onClick={() => onInspect(strategy.id)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30",
              accent.icon,
            )}
          >
            <ModeIcon id={strategy.id} />
          </span>
          <span className="flex flex-wrap justify-end gap-1">
            {state === "primary" ? (
              <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]", accent.chip)}>
                Primary
              </span>
            ) : null}
            {state === "module" ? (
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
                Module
              </span>
            ) : null}
            {strategy.advanced ? (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                Advanced
              </span>
            ) : null}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-semibold tracking-tight">{strategy.name}</h3>
        <p className="mt-1 text-sm text-white/55">{strategy.short}</p>
        <p
          className={cn(
            "mt-2 text-xs leading-relaxed text-white/40 transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          {strategy.does}
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
          {strategy.designedFor}
        </p>
        {strategy.id === "flywheel" ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {["Buybacks", "Liquidity", "Treasury", "Burns", "Holders"].map((lane) => (
              <span
                key={lane}
                className="rounded-full border border-arc/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-arc/80"
              >
                {lane}
              </span>
            ))}
          </div>
        ) : null}
      </button>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPrimary(strategy.id)}
          className={cn(
            "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]",
            state === "primary"
              ? "border-white bg-white text-black"
              : "border-white/15 text-white/60 hover:text-white",
          )}
        >
          {state === "primary" ? "Primary selected" : "Set primary"}
        </button>
        {strategy.id !== "standard" || state === "module" ? (
          <button
            type="button"
            onClick={() => onToggleModule(strategy.id)}
            disabled={state === "primary"}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]",
              state === "module"
                ? "border-arc/40 text-arc"
                : "border-white/15 text-white/60 hover:text-white disabled:opacity-30",
            )}
          >
            {state === "module" ? "Remove module" : "Add module"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
