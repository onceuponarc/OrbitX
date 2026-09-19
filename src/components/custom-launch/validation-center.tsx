"use client";

import { Button } from "@/components/ui/button";
import { evaluateReadiness, launchIsReady, type ReadinessCheck } from "@/lib/custom-launch/readiness";
import type { CustomLaunchDraft, CustomLaunchStepId } from "@/lib/custom-launch/schema";
import { cn } from "@/lib/utils";

export function ValidationCenter({
  draft,
  onEdit,
}: {
  draft: CustomLaunchDraft;
  onEdit: (id: CustomLaunchStepId) => void;
}) {
  return <LaunchReadiness draft={draft} onEdit={onEdit} />;
}

export function LaunchReadiness({
  draft,
  onEdit,
}: {
  draft: CustomLaunchDraft;
  onEdit: (id: CustomLaunchStepId) => void;
}) {
  const checks = evaluateReadiness(draft);
  const ready = launchIsReady(draft);

  return (
    <section className="ox-console rounded-[1.35rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Launch readiness</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Local mock validation</h3>
          <p className="mt-1 text-xs text-white/40">UI checks only. No chain, API, or wallet is consulted.</p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
            ready ? "bg-buy/12 text-buy" : "bg-heat/12 text-heat",
          )}
        >
          {ready ? "Ready to deploy" : "Configuration required"}
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {checks.map((check) => (
          <ReadinessRow key={check.id} check={check} onEdit={onEdit} />
        ))}
      </ul>
    </section>
  );
}

function ReadinessRow({
  check,
  onEdit,
}: {
  check: ReadinessCheck;
  onEdit: (id: CustomLaunchStepId) => void;
}) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3",
        check.pass ? "border-buy/20 bg-buy/5" : "border-heat/25 bg-heat/5",
      )}
    >
      <div>
        <p className="text-sm font-medium">
          <span className="mr-2 font-mono text-xs">{check.pass ? "✓" : "○"}</span>
          {check.label}
        </p>
        <p className="mt-1 text-xs text-white/50">{check.detail}</p>
      </div>
      {check.pass ? null : (
        <Button type="button" size="sm" variant="outline" onClick={() => onEdit(check.step)}>
          Fix
        </Button>
      )}
    </li>
  );
}
