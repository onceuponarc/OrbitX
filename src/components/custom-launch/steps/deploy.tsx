"use client";

import { Button } from "@/components/ui/button";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { StatusChip } from "@/components/custom-launch/status-chip";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { launchModeTitle } from "@/lib/custom-launch/schema";

export function DeployStep() {
  const { draft, meta, ready, missing, markReviewed, setStep } = useCustomLaunch();

  return (
    <ControlPanel
      eyebrow="08 · Deploy"
      title="Preview the print. Do not broadcast."
      body="This phase is the Custom Launch control surface only. OrbitX will not sign, submit, collect fees, or create a pool from this screen. The draft stays in this browser."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Venue" value={meta.longLabel} hint={meta.venue} />
        <MetricTile label="Launch type" value="Custom" tone="live" />
        <MetricTile
          label="Desk state"
          value={draft.reviewedAt ? "Reviewed locally" : ready ? "Ready to review" : "Incomplete"}
          tone={draft.reviewedAt ? "live" : ready ? "default" : "warn"}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-gold/20 bg-gold/5 px-4 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">UI foundation</p>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          No transaction is created here. There is no confirmation, no explorer link, and no claim
          that a token exists. Finish the draft, mark it reviewed, and wait for a later phase to
          wire the print.
        </p>
      </div>

      {!ready ? (
        <div className="mt-5 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Still incomplete</p>
          {missing
            .filter((step) => step.id !== "deploy" && step.id !== "review")
            .map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setStep(step.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-left hover:border-white/25"
              >
                <span className="text-sm">{step.label}</span>
                <StatusChip status="incomplete" />
              </button>
            ))}
        </div>
      ) : (
        <dl className="mt-5 grid gap-3 rounded-2xl border border-white/10 px-4 py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Instrument</dt>
            <dd className="mt-1">
              {draft.token.name} · ${draft.token.symbol} · {launchModeTitle(draft.mode)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Local draft</dt>
            <dd className="mt-1 font-mono text-xs text-white/70">
              orbitx.custom-launch.v3.{draft.chain}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!ready} onClick={markReviewed}>
          Mark configuration reviewed
        </Button>
        <p className="text-xs text-white/40">
          {draft.reviewedAt
            ? `Reviewed ${new Date(draft.reviewedAt).toLocaleString()} — still not deployed.`
            : "Stores a local review stamp only."}
        </p>
      </div>
    </ControlPanel>
  );
}
