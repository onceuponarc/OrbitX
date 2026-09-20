"use client";

import { DeploymentPreview } from "@/components/custom-launch/deployment-preview";
import { DeploymentProgress } from "@/components/custom-launch/deployment-progress";
import { DeploymentSuccess } from "@/components/custom-launch/deployment-success";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { StatusChip } from "@/components/custom-launch/status-chip";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { launchModeTitle } from "@/lib/custom-launch/schema";

export function DeployStep() {
  const { draft, meta, ready, missing, setStep, deployPhase, signedIn, handle, capabilities, deployBlockedReason } =
    useCustomLaunch();

  if (deployPhase === "running") return <DeploymentProgress />;
  if (deployPhase === "ready" || deployPhase === "failed") return <DeploymentSuccess />;

  return (
    <div className="space-y-4">
      <ControlPanel
        eyebrow="08 · Deploy"
        title="Broadcast the Custom Launch."
        body="Deployment is signed by the OrbitX desk, not the browser wallet. Strategy vaults are protocol-controlled. Normal Launch is unchanged."
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricTile label="Venue" value={meta.longLabel} hint={meta.venue} />
          <MetricTile label="Launch type" value="Custom" tone="live" />
          <MetricTile
            label="Desk state"
            value={draft.reviewedAt ? "Reviewed" : ready ? "Ready to review" : "Incomplete"}
            tone={draft.reviewedAt ? "live" : ready ? "default" : "warn"}
          />
          <MetricTile
            label="Session"
            value={!signedIn ? "Sign in required" : handle ? `@${handle}` : "Signed in"}
            tone={signedIn ? "live" : "warn"}
          />
          <MetricTile
            label="Chain desk"
            value={capabilities?.tokenCreate ? "Token create live" : "Not deployable"}
            tone={capabilities?.tokenCreate ? "live" : "warn"}
            hint={capabilities?.poolCreate ? "Pool included" : "Pool unsupported"}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-gold/20 bg-gold/5 px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">On-chain desk</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Confirming this print creates the token and, where the chain supports a Custom Launch pool,
            an OrbitX-seeded public book (PumpSwap on Solana, Uniswap-style AMM on Arc), fee router, and
            strategy vaults. You do not deposit quote liquidity. Remove-liquidity is not available. Success
            requires a confirmed transaction hash.
          </p>
        </div>

        {deployBlockedReason ? (
          <p className="mt-4 rounded-2xl border border-heat/30 bg-heat/10 px-4 py-3 text-sm text-heat">
            {deployBlockedReason}{" "}
            {!signedIn ? (
              <a href="/auth/login" className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
                Sign in
              </a>
            ) : null}
          </p>
        ) : null}

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
                orbitx.custom-launch.v4.{draft.chain}
              </dd>
            </div>
          </dl>
        )}
      </ControlPanel>
      <DeploymentPreview />
    </div>
  );
}
