"use client";

import { Field } from "@/components/custom-launch/field";
import { MetricTile } from "@/components/custom-launch/panel";
import { Input } from "@/components/ui/input";
import {
  formatUsdEstimate,
} from "@/lib/custom-launch/fees";
import {
  simulatePayout,
  simulateRule,
  type AutomationRule,
  type AutomationSim,
} from "@/lib/custom-launch/automation";

export function AutomationPreview({
  rule,
  sim,
  onChange,
}: {
  rule: AutomationRule | undefined;
  sim: AutomationSim;
  onChange: (next: Partial<AutomationSim>) => void;
}) {
  const hit = rule ? simulateRule(rule, sim) : null;
  const fee = Number(sim.feeBalance) || 0;
  const payouts = rule ? simulatePayout(rule, fee) : [];

  return (
    <section className="ox-console rounded-[1.35rem] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Simulation / Preview</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">What this rule would do</h3>
      <p className="mt-1 text-xs text-white/40">
        Mock readings only. This preview does not claim fees, move funds, or schedule a job.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SimField label="Fee balance" value={sim.feeBalance} onChange={(feeBalance) => onChange({ feeBalance })} />
        <SimField label="Market cap" value={sim.marketCap} onChange={(marketCap) => onChange({ marketCap })} />
        <SimField label="Holders" value={sim.holders} onChange={(holders) => onChange({ holders })} />
        <SimField label="Volume" value={sim.volume} onChange={(volume) => onChange({ volume })} />
        <SimField label="Liquidity" value={sim.liquidity} onChange={(liquidity) => onChange({ liquidity })} />
      </div>
      {!rule ? (
        <p className="mt-4 text-sm text-white/45">Select or create a rule to preview it.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricTile
              label="Condition"
              value={hit?.ready ? "Threshold reached" : "Not reached"}
              hint={hit?.reason}
              tone={hit?.ready ? "live" : "default"}
            />
            <MetricTile
              label="Automation"
              value={hit?.ready ? "Ready in preview" : "Waiting in preview"}
              hint="Simulation only"
            />
          </div>
          {payouts.length ? (
            <ul className="mt-4 space-y-2">
              {payouts.map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2 text-sm">
                  <span>{row.label}</span>
                  <span className="font-mono tabular-nums text-white/70">{formatUsdEstimate(row.usd)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

function SimField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Field label={label}>
      <Input value={value} onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))} />
    </Field>
  );
}
