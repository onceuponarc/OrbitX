"use client";

import { ModeCard } from "@/components/custom-launch/mode-card";
import { ModeDetails } from "@/components/custom-launch/mode-details";
import { ModeStack } from "@/components/custom-launch/mode-stack";
import { StrategyPreview } from "@/components/custom-launch/strategy-preview";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import {
  LAUNCH_STRATEGIES,
  defaultStrategyIntent,
  inspectStrategy,
  launchModeTitle,
  setPrimaryStrategy,
  toggleStrategyModule,
  type LaunchStrategyId,
  type StrategyIntent,
} from "@/lib/custom-launch/modes";

export function LaunchModeStep() {
  const { draft, patch, meta, goAdjacent } = useCustomLaunch();
  const mode = draft.mode;

  function writeMode(next: typeof mode) {
    patch("mode", next);
  }

  function cardState(id: LaunchStrategyId) {
    if (mode.primary === id) return "primary" as const;
    if (mode.modules.includes(id)) return "module" as const;
    if (mode.inspected === id) return "inspect" as const;
    return "idle" as const;
  }

  function patchIntent(id: LaunchStrategyId, next: Partial<StrategyIntent>) {
    writeMode({
      ...mode,
      inspected: id,
      intents: {
        ...mode.intents,
        [id]: {
          ...(mode.intents[id] ?? defaultStrategyIntent(id)),
          ...next,
        },
      },
    });
  }

  return (
    <section className="space-y-4">
      <div className="ox-console rounded-[1.4rem] p-5 lg:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">01 · Launch Mode</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">How the economy will operate</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
          Pick a primary thesis, then stack modules if the print needs more than one router.
          Flywheel + Holder Rewards + Charity is a valid desk. So is Buyback + Burn + Liquidity.
          Configuration stays local. Nothing executes from this screen.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <ModeStack mode={mode} onInspect={(id) => writeMode(inspectStrategy(mode, id))} />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
            {meta.longLabel} · {launchModeTitle(mode)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {LAUNCH_STRATEGIES.map((strategy) => (
            <ModeCard
              key={strategy.id}
              strategy={strategy}
              state={cardState(strategy.id)}
              onInspect={(id) => writeMode(inspectStrategy(mode, id))}
              onPrimary={(id) => writeMode(setPrimaryStrategy(mode, id))}
              onToggleModule={(id) => writeMode(toggleStrategyModule(mode, id))}
            />
          ))}
        </div>
        <div className="space-y-4">
          <StrategyPreview mode={mode} />
          <ModeDetails mode={mode} onIntent={patchIntent} onContinue={() => goAdjacent(1)} />
        </div>
      </div>
    </section>
  );
}
