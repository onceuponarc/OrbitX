"use client";

import { ChoiceGrid } from "@/components/custom-launch/choice-grid";
import { Field } from "@/components/custom-launch/field";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { allocationTotalBps, formatBps, formatHours } from "@/lib/custom-launch/schema";
import { Input } from "@/components/ui/input";

export function PrimaryMarketStep() {
  const { draft, patch, meta } = useCustomLaunch();
  const total = allocationTotalBps(draft);
  const balanced = total === 10_000;

  return (
    <ControlPanel
      eyebrow="04 · Primary Market"
      title="Opening book"
      body="The first market is where supply is sold, not where it later trades. Set discovery, raise, duration, and who is allocated before any secondary venue is named."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Raise target" value={draft.primary.raiseTarget ? `${draft.primary.raiseTarget} ${meta.quote}` : "—"} />
        <MetricTile label="Window" value={formatHours(draft.primary.durationHours)} />
        <MetricTile
          label="Allocation"
          value={formatBps(total)}
          hint={balanced ? "Sums to 100%" : "Must sum to 100%"}
          tone={balanced ? "live" : "warn"}
        />
      </div>
      <div className="mt-5">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Price discovery</p>
        <ChoiceGrid
          columns={3}
          value={draft.primary.discovery}
          onChange={(discovery) => patch("primary", { discovery })}
          options={[
            { id: "curve", title: "Curve", body: "Continuous book" },
            { id: "fixed", title: "Fixed", body: "Single clearing price" },
            { id: "dutch", title: "Dutch", body: "Descending window" },
          ]}
        />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={`Raise target (${meta.quote})`}>
          <Input
            value={draft.primary.raiseTarget}
            onChange={(event) => patch("primary", { raiseTarget: event.target.value })}
            placeholder="0"
          />
        </Field>
        <Field label={`Soft cap (${meta.quote})`}>
          <Input
            value={draft.primary.softCap}
            onChange={(event) => patch("primary", { softCap: event.target.value })}
            placeholder="Optional"
          />
        </Field>
        <Field label={`Hard cap (${meta.quote})`}>
          <Input
            value={draft.primary.hardCap}
            onChange={(event) => patch("primary", { hardCap: event.target.value })}
            placeholder="Optional"
          />
        </Field>
        <Field label="Duration (hours)">
          <Input
            type="number"
            min={1}
            max={720}
            value={draft.primary.durationHours}
            onChange={(event) =>
              patch("primary", { durationHours: Math.max(1, Math.min(720, Number(event.target.value) || 1)) })
            }
          />
        </Field>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <AllocField
          label="Public"
          value={draft.primary.publicBps}
          onChange={(publicBps) => patch("primary", { publicBps })}
        />
        <AllocField
          label="Community"
          value={draft.primary.communityBps}
          onChange={(communityBps) => patch("primary", { communityBps })}
        />
        <AllocField
          label="Creator"
          value={draft.primary.creatorBps}
          onChange={(creatorBps) => patch("primary", { creatorBps })}
        />
      </div>
    </ControlPanel>
  );
}

function AllocField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <Field label={`${label} allocation`} hint={formatBps(value)}>
      <Input
        type="number"
        min={0}
        max={100}
        step={1}
        value={(value / 100).toString()}
        onChange={(event) => {
          const pct = Number(event.target.value);
          onChange(Number.isFinite(pct) ? Math.round(Math.max(0, Math.min(100, pct)) * 100) : 0);
        }}
      />
    </Field>
  );
}
