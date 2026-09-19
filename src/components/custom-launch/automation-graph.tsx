"use client";

import {
  ACTION_META,
  formatTriggerLine,
  TRIGGER_META,
  type AutomationRule,
} from "@/lib/custom-launch/automation";
import { FEE_DESTINATIONS } from "@/lib/custom-launch/fees";
import { formatBps } from "@/lib/custom-launch/schema";

export function AutomationGraph({ rule }: { rule: AutomationRule | undefined }) {
  if (!rule) {
    return (
      <section className="ox-console rounded-[1.35rem] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Visual flow</p>
        <p className="mt-2 text-sm text-white/45">Create a rule to see the automation graph.</p>
      </section>
    );
  }

  const destinations = rule.routes.filter((row) => row.bps > 0);

  return (
    <section className="ox-console relative overflow-hidden rounded-[1.35rem] p-5">
      <div className="pointer-events-none absolute inset-y-0 left-[18px] w-px bg-gradient-to-b from-gold/0 via-gold/50 to-gold/0 ox-router-pulse" />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Visual flow</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">{rule.name || "Untitled rule"}</h3>
      <p className="mt-1 text-xs text-white/40">Interactive map of the local rule. Nothing is dispatched.</p>
      <ol className="relative mt-5 space-y-2">
        <li className="rounded-2xl border border-gold/35 bg-gold/8 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">When</p>
          <p className="mt-1 text-sm font-semibold">{TRIGGER_META[rule.trigger].label}</p>
          <p className="mt-1 text-xs text-white/50">{formatTriggerLine(rule)}</p>
        </li>
        {rule.actions.map((action) => (
          <li key={action.id} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Then</p>
            <p className="mt-1 text-sm font-semibold">{ACTION_META[action.kind].label}</p>
          </li>
        ))}
        {destinations.length ? (
          <li className="rounded-2xl border border-white/10 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Fee router</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {destinations.map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                  <span>{FEE_DESTINATIONS[row.destination].label}</span>
                  <span className="font-mono text-xs text-white/50">{formatBps(row.bps)}</span>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ol>
    </section>
  );
}
