"use client";

import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { StatusChip } from "@/components/custom-launch/status-chip";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import {
  CUSTOM_LAUNCH_STEPS,
  formatBps,
  formatHours,
  launchModeSummary,
  launchModeTitle,
  stepStatus,
} from "@/lib/custom-launch/schema";
import { cn } from "@/lib/utils";

export function ReviewStep() {
  const { draft, meta, setStep, ready, configured, total } = useCustomLaunch();

  return (
    <ControlPanel
      eyebrow="07 · Review"
      title="What is set, what is missing"
      body="Read the draft as a control tape. Jump any incomplete row. Review does not submit, sign, or print."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Configured" value={`${configured} / ${total}`} tone={ready ? "live" : "warn"} />
        <MetricTile label="Chain" value={meta.longLabel} hint="Custom Launch" />
        <MetricTile label="Mode" value={launchModeTitle(draft.mode)} hint={launchModeSummary(draft.mode)} />
      </div>
      <ol className="mt-5 space-y-2">
        {CUSTOM_LAUNCH_STEPS.filter((step) => step.id !== "review" && step.id !== "deploy").map((step) => {
          const status = stepStatus(draft, step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => setStep(step.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  status === "complete"
                    ? "border-buy/20 bg-buy/5"
                    : "border-white/10 bg-black/20 hover:border-white/25",
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className="mt-0.5 block text-xs text-white/45">{summaryFor(step.id, draft, meta.quote)}</span>
                </span>
                <StatusChip status={status} />
              </button>
            </li>
          );
        })}
      </ol>
      <dl className="mt-5 grid gap-3 rounded-2xl border border-white/10 px-4 py-4 text-sm sm:grid-cols-2">
        <Row label="Token" value={draft.token.name ? `${draft.token.name} · $${draft.token.symbol || "—"}` : "—"} />
        <Row label="Supply" value={draft.token.supply || "—"} />
        <Row label="Fees" value={`${formatBps(draft.fees.tradingFeeBps)} trading fee`} />
        <Row
          label="Primary"
          value={
            draft.primary.raiseTarget
              ? `${draft.primary.raiseTarget} ${meta.quote} · ${formatHours(draft.primary.durationHours)}`
              : "Raise not set"
          }
        />
        <Row
          label="Secondary"
          value={
            draft.secondary.listOnDex
              ? `${draft.secondary.quotePair || "pair"} · seed ${draft.secondary.seedLiquidity || "—"}`
              : "DEX listing off"
          }
        />
        <Row
          label="Automation"
          value={`sweep ${draft.automation.feeSweep} · LP ${draft.automation.autoLiquidity ? "on" : "off"}`}
        />
      </dl>
    </ControlPanel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</dt>
      <dd className="mt-1 text-white/80">{value}</dd>
    </div>
  );
}

function summaryFor(
  id: (typeof CUSTOM_LAUNCH_STEPS)[number]["id"],
  draft: ReturnType<typeof useCustomLaunch>["draft"],
  quote: string,
) {
  switch (id) {
    case "mode":
      return launchModeSummary(draft.mode);
    case "token":
      return draft.token.name ? `${draft.token.name} ($${draft.token.symbol || "—"})` : "Name and ticker required";
    case "economics":
      return `${formatBps(draft.fees.tradingFeeBps)} trading fee`;
    case "primary":
      return draft.primary.raiseTarget ? `${draft.primary.raiseTarget} ${quote}` : "Raise target required";
    case "secondary":
      return draft.secondary.listOnDex
        ? draft.secondary.seedLiquidity
          ? `${draft.secondary.quotePair} · ${draft.secondary.seedLiquidity} ${quote}`
          : "Seed liquidity required"
        : "Listing off";
    case "automation":
      return `Sweep ${draft.automation.feeSweep}`;
    default:
      return "";
  }
}
