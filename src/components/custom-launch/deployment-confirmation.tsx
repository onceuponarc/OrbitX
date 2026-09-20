"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { reviewSnapshot } from "@/lib/custom-launch/review";

export function DeploymentConfirmation() {
  const { draft, deployPhase, closeDeployConfirm, startDeploy, setStep, canBroadcast, deployBlockedReason } =
    useCustomLaunch();
  const [understood, setUnderstood] = useState(false);
  const snap = reviewSnapshot(draft);

  if (deployPhase !== "confirming") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-confirm-title"
        className="ox-console w-full max-w-lg rounded-[1.5rem] p-5 sm:p-6"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Final confirmation</p>
        <h3 id="deploy-confirm-title" className="mt-1 text-2xl font-semibold tracking-tight">
          Deploy Custom Launch?
        </h3>
        <p className="mt-2 text-sm text-white/50">
          This submits a real on-chain deployment from your OrbitX desk. Strategy vaults are protocol-controlled.
          Liquidity cannot be removed later through Custom Launch.
        </p>
        <dl className="mt-5 grid gap-3 rounded-2xl border border-white/10 px-4 py-4 text-sm sm:grid-cols-2">
          <Row label="Chain" value={snap.chain.longLabel} />
          <Row label="Token" value={`${snap.token.name} · ${snap.token.symbol}`} />
          <Row label="Pair" value={snap.market.pair} />
          <Row label="Trading fee" value={snap.economics.tradingFee} />
          <Row label="Launch book" value="Buyer-funded bonding curve" />
          <Row label="Automation rules" value={String(snap.automation.total)} />
          <div className="sm:col-span-2">
            <Row label="Fee routing" value={snap.economics.routing} />
          </div>
        </dl>
        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            className="mt-1 size-4 accent-[var(--color-gold,#d6ff3d)]"
          />
          <span>I understand this configuration will determine the token&apos;s launch economics.</span>
        </label>
        {deployBlockedReason ? <p className="mt-3 text-sm text-heat">{deployBlockedReason}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeDeployConfirm}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              closeDeployConfirm();
              setStep("review");
            }}
          >
            Review Configuration
          </Button>
          <Button
            type="button"
            disabled={!understood || !canBroadcast}
            onClick={() => {
              closeDeployConfirm();
              void startDeploy();
            }}
          >
            Deploy
          </Button>
        </div>
      </div>
    </div>
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
