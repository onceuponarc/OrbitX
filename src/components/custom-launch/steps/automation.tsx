"use client";

import { useMemo, useState } from "react";
import { AutomationGraph } from "@/components/custom-launch/automation-graph";
import { AutomationPreview } from "@/components/custom-launch/automation-preview";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { Field } from "@/components/custom-launch/field";
import { MilestoneTimeline } from "@/components/custom-launch/milestone-timeline";
import { RuleBuilder } from "@/components/custom-launch/rule-builder";
import { RuleCard } from "@/components/custom-launch/rule-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTION_META,
  COMPARE_META,
  createRule,
  duplicateRule,
  RULE_TEMPLATES,
  TRIGGER_META,
  type AutomationRule,
} from "@/lib/custom-launch/automation";

export function AutomationStep() {
  const { draft, update } = useCustomLaunch();
  const { automation } = draft;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(automation.rules[0]?.id ?? null);
  const [advanced, setAdvanced] = useState(false);

  const selected = useMemo(
    () => automation.rules.find((rule) => rule.id === (editingId ?? selectedId)) ?? automation.rules[0],
    [automation.rules, editingId, selectedId],
  );
  const editing = automation.rules.find((rule) => rule.id === editingId);

  function setRules(rules: AutomationRule[]) {
    update((current) => ({ ...current, automation: { ...current.automation, rules } }));
  }

  function patchRule(id: string, next: AutomationRule) {
    setRules(automation.rules.map((rule) => (rule.id === id ? next : rule)));
  }

  function createBlank() {
    const rule = createRule({ name: "New rule", trigger: "fee_balance" }, draft.mode, draft.fees);
    setRules([...automation.rules, rule]);
    setEditingId(rule.id);
    setSelectedId(rule.id);
  }

  return (
    <section className="space-y-4">
      <div className="ox-console rounded-[1.4rem] p-5 lg:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">06 · Automation Engine</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Define what your token does automatically</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
          Build WHEN → CONDITION → ACTION → DESTINATION rules in this browser. The engine is a
          configuration surface only — it does not claim fees, move funds, or arm a job.
        </p>
      </div>

      <div className="ox-console rounded-[1.35rem] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Templates</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {RULE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                const rule = template.build(draft.mode, draft.fees);
                setRules([...automation.rules, rule]);
                setSelectedId(rule.id);
                setEditingId(rule.id);
              }}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left hover:border-white/25"
            >
              <p className="text-sm font-semibold">{template.name}</p>
              <p className="mt-1 text-xs text-white/45">{template.body}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
          {automation.rules.length} rule{automation.rules.length === 1 ? "" : "s"}
        </p>
        <Button type="button" onClick={createBlank}>
          Create rule
        </Button>
      </div>

      {editing ? (
        <RuleBuilder
          rule={editing}
          onChange={(next) => patchRule(editing.id, next)}
          onClose={() => setEditingId(null)}
          onSave={() => setEditingId(null)}
        />
      ) : null}

      {automation.rules.length === 0 ? (
        <p className="rounded-[1.25rem] border border-white/10 px-4 py-6 text-sm text-white/45">
          No rules yet. Start from a template or create a blank rule. Automation is optional for this draft.
        </p>
      ) : (
        <div className="space-y-3">
          {automation.rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              selected={rule.id === selected?.id}
              onSelect={() => setSelectedId(rule.id)}
              onEdit={() => {
                setSelectedId(rule.id);
                setEditingId(rule.id);
              }}
              onDuplicate={() => {
                const copy = duplicateRule(rule);
                setRules([...automation.rules, copy]);
                setSelectedId(copy.id);
              }}
              onToggle={() =>
                patchRule(rule.id, {
                  ...rule,
                  status: rule.status === "active" ? "paused" : "active",
                })
              }
              onDelete={() => {
                const next = automation.rules.filter((item) => item.id !== rule.id);
                setRules(next);
                if (editingId === rule.id) setEditingId(null);
                if (selectedId === rule.id) setSelectedId(next[0]?.id ?? null);
              }}
            />
          ))}
        </div>
      )}

      <MilestoneTimeline
        milestones={automation.milestones}
        onChange={(milestones) =>
          update((current) => ({ ...current, automation: { ...current.automation, milestones } }))
        }
      />

      <AutomationPreview
        rule={selected}
        sim={automation.simulation}
        onChange={(simulation) =>
          update((current) => ({
            ...current,
            automation: { ...current.automation, simulation: { ...current.automation.simulation, ...simulation } },
          }))
        }
      />

      <AutomationGraph rule={selected} />

      <section className="ox-console rounded-[1.35rem] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Automation safety</p>
        <ul className="mt-3 space-y-2 text-sm text-white/60">
          <li>Automation will only execute when the configured conditions are satisfied.</li>
          <li>Review all destination wallets before a later deployment phase.</li>
          <li>This screen does not move funds, claim fees, or schedule an on-chain job.</li>
        </ul>
      </section>

      <section className="ox-console rounded-[1.35rem] p-5">
        <button type="button" onClick={() => setAdvanced((value) => !value)} className="flex w-full items-center justify-between">
          <span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Advanced rule builder</span>
            <span className="text-sm font-semibold">Visual programming table</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            {advanced ? "Hide" : "Show"}
          </span>
        </button>
        {advanced && selected ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="font-mono uppercase tracking-[0.12em] text-white/35">
                <tr>
                  <th className="pb-2 pr-4">Trigger</th>
                  <th className="pb-2 pr-4">Condition</th>
                  <th className="pb-2 pr-4">Join</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2">Cooldown</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                <tr>
                  <td className="pr-4 py-2">{TRIGGER_META[selected.trigger].label}</td>
                  <td className="pr-4 py-2">
                    {selected.conditions
                      .map((row) => `${TRIGGER_META[row.metric].label} ${COMPARE_META[row.op]} ${row.value}`)
                      .join(` ${selected.join.toUpperCase()} `) || "—"}
                  </td>
                  <td className="pr-4 py-2">{selected.join.toUpperCase()}</td>
                  <td className="pr-4 py-2">{selected.actions.map((row) => ACTION_META[row.kind].label).join(" → ")}</td>
                  <td className="pr-4 py-2">${selected.maxExecution}</td>
                  <td className="py-2">{selected.cooldown}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Cooldown">
                <Input
                  value={selected.cooldown}
                  onChange={(event) => patchRule(selected.id, { ...selected, cooldown: event.target.value })}
                />
              </Field>
              <Field label="Max execution (USD)">
                <Input
                  value={selected.maxExecution}
                  onChange={(event) => patchRule(selected.id, { ...selected, maxExecution: event.target.value })}
                />
              </Field>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
