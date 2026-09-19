"use client";

import { Button } from "@/components/ui/button";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { reviewSnapshot } from "@/lib/custom-launch/review";
import { cn } from "@/lib/utils";

export function DeploymentPreview() {
  const { draft, meta, openDeployConfirm } = useCustomLaunch();
  const snap = reviewSnapshot(draft);
  const ready = snap.ready;

  return (
    <section className="ox-console relative overflow-hidden rounded-[1.5rem] p-5 lg:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_100%_0%,rgb(214_255_61/14%),transparent_55%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">Deployment preview</p>
            <h3 className="mt-1 text-3xl font-semibold tracking-tight">Custom Launch</h3>
            <p className="mt-1 text-sm text-white/45">Local print preview. This button does not broadcast.</p>
          </div>
          <ChainMark label={meta.label} short={meta.short} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <PreviewRow label="Token" value={snap.token.symbol === "—" ? "$SYMBOL" : snap.token.symbol} accent />
          <PreviewRow label="Strategy" value={snap.preview.strategy} />
          <PreviewRow label="Primary market" value={snap.preview.pair} />
          <PreviewRow label="Initial liquidity" value={snap.preview.liquidity} />
          <PreviewRow label="Trading fee" value={snap.preview.fee} />
          <PreviewRow label="Automation" value={snap.preview.rules} />
          <PreviewRow label="Markets" value={snap.preview.markets} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            disabled={!ready}
            onClick={openDeployConfirm}
            className={cn(
              "h-12 min-w-[220px] rounded-2xl px-5 text-base font-semibold",
              ready && "bg-gold text-ink hover:bg-gold/90",
            )}
          >
            Deploy Custom Launch
          </Button>
          {!ready ? (
            <p className="text-sm text-heat">Configuration required — finish the failing Launch Readiness rows.</p>
          ) : (
            <p className="text-xs text-white/40">Opens a confirmation. Still not a live print.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PreviewRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tracking-tight", accent && "text-gold")}>{value}</p>
    </div>
  );
}

export function ChainMark({ label, short }: { label: string; short: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold/8 px-4 py-3">
      <span className="flex size-12 items-center justify-center rounded-full border border-gold/40 bg-black font-mono text-sm text-gold shadow-[0_0_18px_rgb(214_255_61/25%)]">
        {short.slice(0, 3)}
      </span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Chain logo</p>
        <p className="text-sm font-semibold">{label}</p>
      </div>
    </div>
  );
}
