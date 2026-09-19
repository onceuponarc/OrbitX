"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeIcon } from "@/components/custom-launch/mode-icon";
import { modeAccent } from "@/components/custom-launch/mode-accent";
import {
  MOCK_CHARITIES,
  defaultStrategyIntent,
  findStrategy,
  type CustomLaunchModeState,
  type LaunchStrategyId,
  type StrategyIntent,
} from "@/lib/custom-launch/modes";
import { Field } from "@/components/custom-launch/field";

export function ModeDetails({
  mode,
  onIntent,
  onContinue,
}: {
  mode: CustomLaunchModeState;
  onIntent: (id: LaunchStrategyId, next: Partial<StrategyIntent>) => void;
  onContinue: () => void;
}) {
  const strategy = findStrategy(mode.inspected);
  if (!strategy) return null;
  const accent = modeAccent(strategy);
  const intent = mode.intents[strategy.id] ?? defaultStrategyIntent(strategy.id);
  const role = mode.primary === strategy.id ? "Primary strategy" : mode.modules.includes(strategy.id) ? "Added module" : "Not in stack yet";

  return (
    <section className="ox-console rounded-[1.35rem] p-4">
      <div className="flex items-start gap-3">
        <span className={`flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 ${accent.icon}`}>
          <ModeIcon id={strategy.id} />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Mode details · {role}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{strategy.name}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/60">{strategy.does}</p>

      <DetailList label="What it does" items={[strategy.short]} />
      <DetailList label="What can be configured" items={strategy.configures} />
      <DetailList label="Automated actions it supports" items={strategy.automations} />
      <DetailList label="Later configuration" items={strategy.laterSteps} />

      {strategy.id === "charity" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Charity" hint="Mock directory. Nothing is sent.">
            <select
              value={intent.charityId}
              onChange={(event) => onIntent(strategy.id, { charityId: event.target.value })}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {MOCK_CHARITIES.map((charity) => (
                <option key={charity.id} value={charity.id} className="bg-ink">
                  {charity.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Charity wallet">
            <Input
              value={
                intent.wallet ||
                MOCK_CHARITIES.find((charity) => charity.id === intent.charityId)?.wallet ||
                ""
              }
              onChange={(event) => onIntent(strategy.id, { wallet: event.target.value })}
              placeholder="Charity wallet"
            />
          </Field>
          <Knob
            label="Allocation %"
            value={(intent.allocationBps / 100).toString()}
            onChange={(value) => onIntent(strategy.id, { allocationBps: toBps(value) })}
          />
          <Field label="Distribution threshold">
            <Input
              value={intent.threshold}
              onChange={(event) => onIntent(strategy.id, { threshold: event.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {strategy.id === "buyback" || strategy.id === "burn" || strategy.id === "liquidity" || strategy.id === "treasury" || strategy.id === "community" || strategy.id === "holders" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Knob
            label="Allocation %"
            value={(intent.allocationBps / 100).toString()}
            onChange={(value) => onIntent(strategy.id, { allocationBps: toBps(value) })}
          />
          <Field label="Trigger threshold">
            <Input
              value={intent.threshold}
              onChange={(event) => onIntent(strategy.id, { threshold: event.target.value })}
            />
          </Field>
          {strategy.id === "buyback" ? (
            <>
              <Field label="Maximum execution">
                <Input
                  value={intent.maxAmount}
                  onChange={(event) => onIntent(strategy.id, { maxAmount: event.target.value })}
                />
              </Field>
              <Field label="Frequency">
                <Input
                  value={intent.frequency}
                  onChange={(event) => onIntent(strategy.id, { frequency: event.target.value })}
                />
              </Field>
            </>
          ) : null}
          {strategy.id === "treasury" || strategy.id === "community" ? (
            <Field label={strategy.id === "treasury" ? "Treasury wallet" : "Community wallet"} className="sm:col-span-2">
              <Input
                value={intent.wallet}
                onChange={(event) => onIntent(strategy.id, { wallet: event.target.value })}
                placeholder="Mock destination"
              />
            </Field>
          ) : null}
          {strategy.id === "liquidity" ? (
            <Field label="Primary pool destination" className="sm:col-span-2">
              <Input
                value={intent.wallet || "Primary venue pair"}
                onChange={(event) => onIntent(strategy.id, { wallet: event.target.value })}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-white/40">
        These knobs only reshape the local preview. They do not execute, claim, or route anything.
      </p>
      <div className="mt-4">
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </section>
  );
}

function DetailList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <ul className="mt-1 space-y-1 text-sm text-white/65">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Knob({
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
      <Input type="number" min={0} max={100} step={1} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function toBps(value: string) {
  const pct = Number(value);
  return Number.isFinite(pct) ? Math.round(Math.max(0, Math.min(100, pct)) * 100) : 0;
}
