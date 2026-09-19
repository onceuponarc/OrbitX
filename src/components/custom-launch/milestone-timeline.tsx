"use client";

import { Field } from "@/components/custom-launch/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTION_KINDS,
  ACTION_META,
  type ActionKind,
  type Milestone,
} from "@/lib/custom-launch/automation";

export function MilestoneTimeline({
  milestones,
  onChange,
}: {
  milestones: Milestone[];
  onChange: (next: Milestone[]) => void;
}) {
  const sorted = [...milestones].sort((a, b) => Number(a.marketCap) - Number(b.marketCap));

  return (
    <section className="ox-console relative overflow-hidden rounded-[1.35rem] p-5">
      <div className="pointer-events-none absolute inset-y-0 left-[22px] w-px bg-gradient-to-b from-gold/0 via-gold/50 to-gold/0 ox-router-pulse" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Milestones</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Market-cap timeline</h3>
          <p className="mt-1 text-xs text-white/40">Preview of intended marks. No action fires from this tape.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([
              ...milestones,
              { id: `ms-${Date.now()}`, marketCap: "250000", action: "buyback" },
            ])
          }
        >
          Add milestone
        </Button>
      </div>
      <ol className="relative mt-5 space-y-3">
        <li className="flex items-center gap-3 pl-1">
          <span className="size-2.5 rounded-full bg-gold" />
          <span className="text-sm font-semibold">Launch</span>
        </li>
        {sorted.map((row) => (
          <li key={row.id} className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[88px_1fr_auto] sm:items-center">
            <Field label="MC">
              <Input
                value={row.marketCap}
                onChange={(event) =>
                  onChange(
                    milestones.map((item) =>
                      item.id === row.id ? { ...item, marketCap: event.target.value.replace(/[^\d]/g, "") } : item,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Action">
              <select
                className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2 text-sm"
                value={row.action}
                onChange={(event) =>
                  onChange(
                    milestones.map((item) =>
                      item.id === row.id ? { ...item, action: event.target.value as ActionKind } : item,
                    ),
                  )
                }
              >
                {ACTION_KINDS.map((id) => (
                  <option key={id} value={id}>
                    {ACTION_META[id].label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(milestones.filter((item) => item.id !== row.id))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
