"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { MOCK_DEPLOY_DISCLAIMER } from "@/lib/custom-launch/mock-deploy";
import { reviewSnapshot } from "@/lib/custom-launch/review";

export function DeploymentSuccess() {
  const { draft, mockResult, setStep } = useCustomLaunch();
  const snap = reviewSnapshot(draft);

  return (
    <div className="space-y-4">
      <section className="ox-console relative overflow-hidden rounded-[1.5rem] p-5 lg:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_140%_at_100%_0%,rgb(214_255_61/16%),transparent_55%)]" />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold/80">Custom Launch Ready</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">CUSTOM LAUNCH READY</h2>
          <p className="mt-2 max-w-xl text-sm text-white/50">{MOCK_DEPLOY_DISCLAIMER}</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ResultMeta label="Token" value={`${snap.token.name} · ${snap.token.symbol}`} />
            <ResultMeta label="Primary market" value={snap.market.pair} />
            <ResultMeta label="Initial liquidity" value={snap.market.liquidity} />
            <ResultMeta label="Trading fee" value={snap.economics.tradingFee} />
            <ResultMeta label="Automation rules" value={String(snap.automation.total)} />
            <ResultMeta label="Secondary markets" value={String(snap.market.secondaryCount)} />
          </dl>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <AddressCard label="Token" value={mockResult?.tokenAddress ?? "MOCK_TOKEN_PENDING"} />
        <AddressCard label="Primary pool" value={mockResult?.poolAddress ?? "MOCK_POOL_PENDING"} />
        <AddressCard label="Launch ID" value={mockResult?.launchId ?? "MOCK-LAUNCH-PENDING"} />
      </div>
      <AddressCard label="Transaction" value={mockResult?.transaction ?? "MOCK_TX_NOT_BROADCAST"} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setStep("deploy")}>
          View Launch
        </Button>
        <Button type="button" variant="outline" onClick={() => setStep("deploy")}>
          Open Launch
        </Button>
        <Button type="button" variant="outline" onClick={() => setStep("economics")}>
          View Economics
        </Button>
        <Button type="button" variant="outline" onClick={() => setStep("automation")}>
          View Automation
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href="/launch">Back to Launchpad</Link>
        </Button>
      </div>
    </div>
  );
}

function ResultMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function AddressCard({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="ox-console rounded-[1.35rem] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">{label}</p>
          <p className="mt-2 break-all font-mono text-sm text-white/80">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </article>
  );
}
