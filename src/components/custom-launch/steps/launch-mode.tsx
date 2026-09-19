"use client";

import { ChoiceGrid } from "@/components/custom-launch/choice-grid";
import { Field } from "@/components/custom-launch/field";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { LAUNCH_MODE_OPTIONS, launchModeTitle } from "@/lib/custom-launch/schema";
import { Textarea } from "@/components/ui/textarea";

export function LaunchModeStep() {
  const { draft, patch, meta } = useCustomLaunch();

  return (
    <ControlPanel
      eyebrow="01 · Launch Mode"
      title="How this token enters the market"
      body="Pick the issuance engine first. Custom Launch is for desks that want the curve, the auction, or the emission schedule under explicit control — not a one-tap meme print."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Chain" value={meta.longLabel} hint={meta.venue} tone="live" />
        <MetricTile label="Mode" value={launchModeTitle(draft.mode.kind)} />
        <MetricTile label="Quote" value={meta.quote} hint="Can be refined in economics" />
      </div>
      <div className="mt-5">
        <ChoiceGrid
          value={draft.mode.kind}
          onChange={(kind) => patch("mode", { kind })}
          options={LAUNCH_MODE_OPTIONS}
        />
      </div>
      <Field
        className="mt-5"
        label="Desk notes"
        hint="Local only. These notes stay in this browser until a later phase can persist them."
      >
        <Textarea
          value={draft.mode.notes}
          onChange={(event) => patch("mode", { notes: event.target.value })}
          placeholder="Intent, unlocks, market-maker notes…"
        />
      </Field>
    </ControlPanel>
  );
}
