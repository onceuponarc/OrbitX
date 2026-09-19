"use client";

import { ChoiceGrid } from "@/components/custom-launch/choice-grid";
import { ToggleRow } from "@/components/custom-launch/field";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import type { FeeSweepCadence } from "@/lib/custom-launch/schema";

export function AutomationStep() {
  const { draft, patch } = useCustomLaunch();
  const { automation } = draft;

  return (
    <ControlPanel
      eyebrow="06 · Automation"
      title="What the desk does without a click"
      body="Schedule the mechanical work: liquidity top-ups, fee sweeps, graduation, and a pause guard. These are intent flags for a later automation layer — they do not arm any bot from this UI."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Fee sweep" value={automation.feeSweep} />
        <MetricTile label="Auto LP" value={automation.autoLiquidity ? "On" : "Off"} />
        <MetricTile label="Pause guard" value={automation.pauseGuard ? "Armed" : "Off"} />
      </div>
      <div className="mt-5 space-y-3">
        <ToggleRow
          label="Auto-liquidity"
          body="Route a slice of volume back into the configured pair after the open."
          checked={automation.autoLiquidity}
          onCheckedChange={(autoLiquidity) => patch("automation", { autoLiquidity })}
        />
        <ToggleRow
          label="Graduate on raise target"
          body="When the primary book hits the raise, mark the draft ready to move to secondary."
          checked={automation.graduateOnTarget}
          onCheckedChange={(graduateOnTarget) => patch("automation", { graduateOnTarget })}
        />
        <ToggleRow
          label="Buyback program"
          body="Sweep a share of fees into a buyback queue. Not executed from this screen."
          checked={automation.buyback}
          onCheckedChange={(buyback) => patch("automation", { buyback })}
        />
        <ToggleRow
          label="Pause guard"
          body="Keep a kill switch on the desk so trading can be halted from the same control surface."
          checked={automation.pauseGuard}
          onCheckedChange={(pauseGuard) => patch("automation", { pauseGuard })}
        />
      </div>
      <div className="mt-5">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Fee sweep</p>
        <ChoiceGrid
          columns={3}
          value={automation.feeSweep}
          onChange={(feeSweep: FeeSweepCadence) => patch("automation", { feeSweep })}
          options={[
            { id: "off", title: "Off", body: "Manual only" },
            { id: "daily", title: "Daily", body: "Once per UTC day" },
            { id: "weekly", title: "Weekly", body: "Friday 00:00 UTC" },
          ]}
        />
      </div>
    </ControlPanel>
  );
}
