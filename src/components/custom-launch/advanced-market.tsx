"use client";

import { useState } from "react";
import { Field } from "@/components/custom-launch/field";
import { ChoiceGrid } from "@/components/custom-launch/choice-grid";
import { ToggleRow } from "@/components/custom-launch/field";
import { Input } from "@/components/ui/input";
import { formatBps } from "@/lib/custom-launch/schema";
import type { AdvancedMarketSettings } from "@/lib/custom-launch/markets";

export function AdvancedMarket({
  value,
  onChange,
}: {
  value: AdvancedMarketSettings;
  onChange: (next: Partial<AdvancedMarketSettings>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="ox-console rounded-[1.35rem] p-4">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Advanced</span>
          <span className="text-sm font-semibold">Pool parameters and activation</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-white/40">
            Future-ready controls. Slippage, locks, and activation are recorded locally — no lock or
            transaction is created.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slippage" hint={formatBps(value.slippageBps)}>
              <Input
                type="number"
                min={0}
                max={50}
                step={0.1}
                value={(value.slippageBps / 100).toString()}
                onChange={(event) => {
                  const pct = Number(event.target.value);
                  onChange({
                    slippageBps: Number.isFinite(pct) ? Math.round(Math.max(0, Math.min(50, pct)) * 100) : 0,
                  });
                }}
              />
            </Field>
            <Field label="Liquidity lock (days)" info="UI only. No tokens are locked from this desk.">
              <Input
                type="number"
                min={0}
                max={1825}
                value={value.lockDays}
                onChange={(event) =>
                  onChange({ lockDays: Math.max(0, Math.min(1825, Number(event.target.value) || 0)) })
                }
              />
            </Field>
          </div>
          <ToggleRow
            label="Record a liquidity lock intent"
            body="Stores the intended lock window. Does not lock LP."
            checked={value.lockEnabled}
            onCheckedChange={(lockEnabled) => onChange({ lockEnabled })}
          />
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Price initialization</p>
            <ChoiceGrid
              columns={2}
              value={value.priceInit}
              onChange={(priceInit) => onChange({ priceInit })}
              options={[
                { id: "auto", title: "Auto", body: "From token / pair amounts" },
                { id: "manual", title: "Manual", body: "Creator-set later" },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Routing preference</p>
            <ChoiceGrid
              columns={3}
              value={value.routingPreference}
              onChange={(routingPreference) => onChange({ routingPreference })}
              options={[
                { id: "primary_first", title: "Primary first", body: "Lead with the first book" },
                { id: "best_price", title: "Best price", body: "Later smart router" },
                { id: "manual", title: "Manual", body: "Creator chooses" },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Primary activation</p>
            <ChoiceGrid
              columns={3}
              value={value.activation}
              onChange={(activation) => onChange({ activation })}
              options={[
                { id: "immediate", title: "Immediate", body: "With the print" },
                { id: "manual", title: "Manual", body: "Creator arms later" },
                { id: "on_target", title: "On target", body: "After a raise mark" },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Secondary activation</p>
            <ChoiceGrid
              columns={3}
              value={value.secondaryActivation}
              onChange={(secondaryActivation) => onChange({ secondaryActivation })}
              options={[
                { id: "manual", title: "Manual", body: "Arm each book" },
                { id: "after_primary", title: "After primary", body: "Follow the first market" },
                { id: "on_liquidity", title: "On liquidity", body: "When depth is set" },
              ]}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
