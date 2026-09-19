"use client";

import { useState } from "react";
import { ChoiceGrid } from "@/components/custom-launch/choice-grid";
import { Field } from "@/components/custom-launch/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTION_KINDS,
  ACTION_META,
  COMPARE_META,
  COMPARE_OPS,
  createAction,
  createCondition,
  formatPreset,
  lockedRouteBps,
  moveItem,
  routeAllocatedBps,
  routesOver,
  ruleError,
  TRIGGER_KINDS,
  TRIGGER_META,
  type AutomationRule,
  type CompareOp,
  type TriggerKind,
} from "@/lib/custom-launch/automation";
import { FEE_DESTINATION_IDS, FEE_DESTINATIONS, type FeeDestinationId } from "@/lib/custom-launch/fees";
import { formatBps } from "@/lib/custom-launch/schema";
import { cn } from "@/lib/utils";

const STEPS = ["when", "do", "route", "review"] as const;

export function RuleBuilder({
  rule,
  onChange,
  onClose,
  onSave,
}: {
  rule: AutomationRule;
  onChange: (next: AutomationRule) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [step, setStep] = useState<(typeof STEPS)[number]>("when");
  const error = ruleError(rule);
  const allocated = routeAllocatedBps(rule.routes);
  const remaining = 10_000 - allocated;

  return (
    <section className="ox-console rounded-[1.4rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Rule builder</p>
          <h3 className="mt-1 text-xl font-semibold">WHEN → DO → ROUTE</h3>
          <p className="mt-1 text-sm text-white/45">Local configuration only. Nothing executes from this builder.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <ol className="mt-4 grid grid-cols-4 gap-2">
        {STEPS.map((id, index) => (
          <button
            key={id}
            type="button"
            onClick={() => setStep(id)}
            className={cn(
              "rounded-2xl border px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em]",
              step === id ? "border-gold/50 bg-gold/10 text-gold" : "border-white/10 text-white/45",
            )}
          >
            {index + 1}. {id}
          </button>
        ))}
      </ol>

      <div className="mt-5">
        {step === "when" ? <WhenStep rule={rule} onChange={onChange} /> : null}
        {step === "do" ? <DoStep rule={rule} onChange={onChange} /> : null}
        {step === "route" ? (
          <RouteStep
            rule={rule}
            allocated={allocated}
            remaining={remaining}
            onChange={onChange}
          />
        ) : null}
        {step === "review" ? <ReviewStep rule={rule} error={error} /> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={step === "when"}
          onClick={() => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)])}
        >
          Back
        </Button>
        {step === "review" ? (
          <Button type="button" disabled={Boolean(error)} onClick={onSave}>
            Save rule
          </Button>
        ) : (
          <Button type="button" onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(step) + 1)])}>
            Continue
          </Button>
        )}
      </div>
    </section>
  );
}

function WhenStep({ rule, onChange }: { rule: AutomationRule; onChange: (next: AutomationRule) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Rule name">
        <Input value={rule.name} onChange={(event) => onChange({ ...rule, name: event.target.value })} />
      </Field>
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">When</p>
        <ChoiceGrid
          columns={2}
          value={rule.trigger}
          onChange={(trigger: TriggerKind) =>
            onChange({
              ...rule,
              trigger,
              conditions: trigger === "manual" ? [] : [createCondition(trigger)],
            })
          }
          options={TRIGGER_KINDS.map((id) => ({ id, title: TRIGGER_META[id].label, body: TRIGGER_META[id].body }))}
        />
      </div>
      {rule.trigger !== "manual" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Conditions</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={rule.join === "and" ? "default" : "outline"}
                onClick={() => onChange({ ...rule, join: "and" })}
              >
                AND
              </Button>
              <Button
                type="button"
                size="sm"
                variant={rule.join === "or" ? "default" : "outline"}
                onClick={() => onChange({ ...rule, join: "or" })}
              >
                OR
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChange({ ...rule, conditions: [...rule.conditions, createCondition(rule.trigger)] })}
              >
                Add condition
              </Button>
            </div>
          </div>
          {rule.conditions.map((condition, index) => (
            <div key={condition.id} className="space-y-2 rounded-2xl border border-white/10 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_72px_1fr_auto]">
                <select
                  className="h-9 rounded-lg border border-white/10 bg-black/40 px-2 text-sm"
                  value={condition.metric}
                  onChange={(event) =>
                    onChange({
                      ...rule,
                      conditions: rule.conditions.map((row) =>
                        row.id === condition.id ? { ...row, metric: event.target.value as TriggerKind } : row,
                      ),
                    })
                  }
                >
                  {TRIGGER_KINDS.filter((id) => id !== "manual").map((id) => (
                    <option key={id} value={id}>
                      {TRIGGER_META[id].label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-lg border border-white/10 bg-black/40 px-2 text-sm"
                  value={condition.op}
                  onChange={(event) =>
                    onChange({
                      ...rule,
                      conditions: rule.conditions.map((row) =>
                        row.id === condition.id ? { ...row, op: event.target.value as CompareOp } : row,
                      ),
                    })
                  }
                >
                  {COMPARE_OPS.map((op) => (
                    <option key={op} value={op}>
                      {COMPARE_META[op]}
                    </option>
                  ))}
                </select>
                <Input
                  value={condition.value}
                  onChange={(event) =>
                    onChange({
                      ...rule,
                      conditions: rule.conditions.map((row) =>
                        row.id === condition.id ? { ...row, value: event.target.value } : row,
                      ),
                    })
                  }
                  placeholder={TRIGGER_META[condition.metric].presets[0] ?? ""}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={rule.conditions.length === 1}
                  onClick={() =>
                    onChange({ ...rule, conditions: rule.conditions.filter((row) => row.id !== condition.id) })
                  }
                >
                  Remove
                </Button>
              </div>
              {TRIGGER_META[condition.metric].presets.length ? (
                <div className="flex flex-wrap gap-1">
                  {TRIGGER_META[condition.metric].presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...rule,
                          conditions: rule.conditions.map((row) =>
                            row.id === condition.id ? { ...row, value: preset } : row,
                          ),
                        })
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                        condition.value === preset
                          ? "border-gold/40 bg-gold/10 text-gold"
                          : "border-white/10 text-white/45 hover:border-white/25",
                      )}
                    >
                      {formatPreset(condition.metric, preset)}
                    </button>
                  ))}
                </div>
              ) : null}
              {index < rule.conditions.length - 1 ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/70">{rule.join}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/45">
          Manual rules stay idle until a later control surface fires them. Nothing is armed here.
        </p>
      )}
    </div>
  );
}

function DoStep({ rule, onChange }: { rule: AutomationRule; onChange: (next: AutomationRule) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Then do</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange({ ...rule, actions: [...rule.actions, createAction("custom")] })}
        >
          Add action
        </Button>
      </div>
      {rule.actions.map((action, index) => (
        <div key={action.id}>
          {index > 0 ? (
            <p className="py-1 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-gold/50">↓</p>
          ) : null}
          <div
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const from = Number(event.dataTransfer.getData("text/plain"));
              onChange({ ...rule, actions: moveItem(rule.actions, from, index) });
            }}
            className="rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-white/30">#{index + 1}</span>
              <select
                className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 text-sm"
                value={action.kind}
                onChange={(event) =>
                  onChange({
                    ...rule,
                    actions: rule.actions.map((row) =>
                      row.id === action.id ? { ...row, kind: event.target.value as (typeof ACTION_KINDS)[number] } : row,
                    ),
                  })
                }
              >
                {ACTION_KINDS.map((id) => (
                  <option key={id} value={id}>
                    {ACTION_META[id].label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={index === 0}
                onClick={() => onChange({ ...rule, actions: moveItem(rule.actions, index, index - 1) })}
              >
                Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={index === rule.actions.length - 1}
                onClick={() => onChange({ ...rule, actions: moveItem(rule.actions, index, index + 1) })}
              >
                Down
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange({ ...rule, actions: rule.actions.filter((row) => row.id !== action.id) })}
              >
                Remove
              </Button>
            </div>
            <p className="mt-2 text-xs text-white/40">{ACTION_META[action.kind].body}</p>
            <Field
              label={
                action.kind === "trigger_rule"
                  ? "Target rule"
                  : action.kind === "custom"
                    ? "Custom instruction"
                    : "Action note"
              }
              className="mt-3"
            >
              <Input
                value={action.note}
                onChange={(event) =>
                  onChange({
                    ...rule,
                    actions: rule.actions.map((row) =>
                      row.id === action.id ? { ...row, note: event.target.value } : row,
                    ),
                  })
                }
                placeholder={
                  action.kind === "trigger_rule"
                    ? "Name of another local rule"
                    : action.kind === "buyback" || action.kind === "add_liquidity"
                      ? "Optional size note — not executed"
                      : "Optional local note"
                }
              />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

function RouteStep({
  rule,
  allocated,
  remaining,
  onChange,
}: {
  rule: AutomationRule;
  allocated: number;
  remaining: number;
  onChange: (next: AutomationRule) => void;
}) {
  const over = routesOver(rule.routes);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Claim fees → Distribute</p>
          <p className="mt-1 text-sm text-white/50">Split after claim. OrbitX stays locked at 25%.</p>
        </div>
        <div className="text-right font-mono text-[11px] uppercase tracking-[0.14em]">
          <p className={over ? "text-heat" : "text-white/70"}>Allocated {formatBps(allocated)}</p>
          <p className={over ? "text-heat" : remaining ? "text-gold" : "text-buy"}>Remaining {formatBps(remaining)}</p>
          <p className={over ? "text-heat" : allocated === 10_000 ? "text-buy" : "text-white/50"}>
            Total {formatBps(allocated)}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {rule.routes.map((row) => {
          const locked = lockedRouteBps(row.destination);
          return (
            <li key={row.id} className="grid grid-cols-[1fr_88px_auto] items-center gap-3 rounded-2xl border border-white/10 px-3 py-2">
              <span className="text-sm">{FEE_DESTINATIONS[row.destination].label}</span>
              <Input
                type="number"
                min={0}
                max={100}
                disabled={locked !== undefined}
                value={(row.bps / 100).toString()}
                onChange={(event) => {
                  const pct = Number(event.target.value);
                  const bps = Number.isFinite(pct) ? Math.round(Math.max(0, Math.min(100, pct)) * 100) : 0;
                  onChange({
                    ...rule,
                    routes: rule.routes.map((item) => (item.id === row.id ? { ...item, bps } : item)),
                  });
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={locked !== undefined}
                onClick={() => onChange({ ...rule, routes: rule.routes.filter((item) => item.id !== row.id) })}
              >
                Remove
              </Button>
            </li>
          );
        })}
      </ul>
      {FEE_DESTINATION_IDS.some((id) => !rule.routes.some((row) => row.destination === id)) ? (
        <div className="mt-3">
          <select
            className="h-9 rounded-lg border border-white/10 bg-black/40 px-2 text-sm"
            defaultValue=""
            onChange={(event) => {
              const destination = event.target.value as FeeDestinationId;
              if (!destination) return;
              onChange({
                ...rule,
                routes: [...rule.routes, { id: destination, destination, bps: 0 }],
              });
              event.target.value = "";
            }}
          >
            <option value="">Add destination</option>
            {FEE_DESTINATION_IDS.filter((id) => !rule.routes.some((row) => row.destination === id)).map((id) => (
              <option key={id} value={id}>
                {FEE_DESTINATIONS[id].label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function ReviewStep({ rule, error }: { rule: AutomationRule; error?: string }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Review</p>
      <dl className="grid gap-3 rounded-2xl border border-white/10 px-4 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Name</dt>
          <dd className="mt-1">{rule.name || "—"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Cooldown</dt>
          <dd className="mt-1">{rule.cooldown}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Max execution</dt>
          <dd className="mt-1">${rule.maxExecution}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Actions</dt>
          <dd className="mt-1">{rule.actions.length}</dd>
        </div>
      </dl>
      {error ? <p className="text-sm text-heat">{error}</p> : <p className="text-sm text-buy">Ready to save locally.</p>}
    </div>
  );
}

