"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { reviewSnapshot } from "@/lib/custom-launch/review";

export function DeploymentSuccess() {
  const { draft, deployResult, deployPhase, deployError, startDeploy, setStep } = useCustomLaunch();
  const snap = reviewSnapshot(draft);

  if (deployPhase === "failed") {
    return (
      <section className="ox-console rounded-[1.5rem] p-5 lg:p-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-heat">Deployment failed</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Not deployed</h2>
        <p className="mt-2 max-w-xl text-sm text-white/60">{deployError}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void startDeploy()}>
            Retry
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("review")}>
            Review configuration
          </Button>
        </div>
      </section>
    );
  }

  const publicHref = deployResult?.slug ? `/custom/${deployResult.slug}` : null;
  const deskHref = deployResult?.slug ? `/custom/${deployResult.slug}/dev` : null;

  return (
    <div className="space-y-4">
      <section className="ox-console relative overflow-hidden rounded-[1.5rem] p-5 lg:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_140%_at_100%_0%,rgb(214_255_61/16%),transparent_55%)]" />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold/80">Custom Launch</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">ON-CHAIN DEPLOYMENT CONFIRMED</h2>
          <p className="mt-2 max-w-xl text-sm text-white/50">
            Token address and transaction hash below come from a confirmed chain receipt, not a local mock.
          </p>
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
        <AddressCard label="Token" value={deployResult?.tokenAddress ?? "—"} />
        <AddressCard label="Primary pool" value={deployResult?.poolAddress ?? "Not created on this chain"} />
        <AddressCard label="Launch ID" value={deployResult?.launchId ?? "—"} />
      </div>
      <AddressCard label="Transaction" value={deployResult?.transaction ?? "—"} href={deployResult?.explorer} />

      <div className="flex flex-wrap gap-2">
        {publicHref ? (
          <Button type="button" asChild>
            <Link href={publicHref}>View Launch</Link>
          </Button>
        ) : null}
        {deskHref ? (
          <Button type="button" variant="outline" asChild>
            <Link href={deskHref}>Open Dev Desk</Link>
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => setStep("economics")}>
          View Economics
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

function AddressCard({ label, value, href }: { label: string; value: string; href?: string | null }) {
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
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="mt-2 block break-all font-mono text-sm text-gold/80">
              {value}
            </a>
          ) : (
            <p className="mt-2 break-all font-mono text-sm text-white/80">{value}</p>
          )}
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
