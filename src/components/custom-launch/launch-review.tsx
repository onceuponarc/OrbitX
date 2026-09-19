"use client";

import { AutomationTimeline } from "@/components/custom-launch/automation-timeline";
import { EconomicsFlow } from "@/components/custom-launch/economics-flow";
import { SectionSummary, SummaryGrid } from "@/components/custom-launch/section-summary";
import { ValidationCenter } from "@/components/custom-launch/validation-center";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { reviewSnapshot } from "@/lib/custom-launch/review";

export function LaunchReview() {
  const { draft, meta, setStep, configured, total } = useCustomLaunch();
  const snap = reviewSnapshot(draft);

  return (
    <div className="space-y-4">
      <ControlPanel
        eyebrow="07 · Review"
        title="Pre-deployment control panel"
        body="Read the entire Custom Launch as a terminal tape. Edit any desk without losing the local draft. Review does not submit, sign, or print."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Configured" value={`${configured} / ${total}`} tone={snap.ready ? "live" : "warn"} />
          <MetricTile label="Chain" value={meta.longLabel} hint={snap.chain.status} />
          <MetricTile label="Status" value={snap.statusLabel} tone={snap.ready ? "live" : "warn"} />
        </div>
      </ControlPanel>

      <SectionSummary eyebrow="Chain" title="Selected venue" step="mode" onEdit={setStep}>
        <SummaryGrid
          rows={[
            { label: "Network", value: `${snap.chain.label} / ${snap.chain.short}` },
            { label: "Selected chain", value: snap.chain.longLabel },
            {
              label: "Chain status",
              value: (
                <span className="inline-flex items-center gap-2">
                  <span className={snap.ready ? "size-2 rounded-full bg-buy" : "size-2 rounded-full bg-gold/60"} />
                  {snap.chain.status}
                </span>
              ),
            },
            { label: "Venue", value: snap.chain.venue },
          ]}
        />
      </SectionSummary>

      <SectionSummary eyebrow="Launch type" title="Custom Launch" step="mode" onEdit={setStep}>
        <SummaryGrid
          rows={[
            { label: "Launch type", value: snap.launchType.kind },
            { label: "Selected strategy", value: snap.launchType.strategy },
            { label: "Additional modules", value: snap.launchType.modules },
          ]}
        />
      </SectionSummary>

      <SectionSummary eyebrow="Token" title={snap.token.name} step="token" onEdit={setStep}>
        <div className="flex flex-wrap gap-4">
          <TokenMarks imageUrl={snap.token.imageUrl} bannerUrl={snap.token.bannerUrl} />
          <div className="min-w-0 flex-1">
            <SummaryGrid
              rows={[
                { label: "Name", value: snap.token.name },
                { label: "Symbol", value: snap.token.symbol },
                { label: "Total supply", value: snap.token.supply },
                { label: "Decimals", value: snap.token.decimals },
                { label: "Description", value: snap.token.description },
                {
                  label: "Social links",
                  value: snap.token.socials.length
                    ? snap.token.socials.map((link) => link.label).join(" · ")
                    : "None",
                },
              ]}
            />
          </div>
        </div>
      </SectionSummary>

      <SectionSummary eyebrow="Market" title={snap.market.pair} step="primary" onEdit={setStep}>
        <SummaryGrid
          rows={[
            { label: "Primary pair", value: snap.market.quote },
            { label: "Initial liquidity", value: snap.market.liquidity },
            { label: "Initial token allocation", value: snap.market.tokenAllocation },
            { label: "Initial price", value: snap.market.price },
            { label: "Estimated starting market cap", value: snap.market.marketCap },
            { label: "Secondary markets", value: snap.market.secondaries },
          ]}
        />
      </SectionSummary>

      <SectionSummary eyebrow="Trading economics" title={`${snap.economics.tradingFee} trading fee`} step="economics" onEdit={setStep}>
        <SummaryGrid
          rows={[
            { label: "Trading fee", value: snap.economics.tradingFee },
            ...snap.economics.allocations.map((row) => ({
              label: `${row.label} allocation`,
              value: `${(row.bps / 100).toFixed(row.bps % 100 === 0 ? 0 : 2)}%`,
            })),
          ]}
        />
      </SectionSummary>

      <SectionSummary eyebrow="Automation" title={`${snap.automation.total} rules`} step="automation" onEdit={setStep}>
        <SummaryGrid
          rows={[
            { label: "Number of rules", value: String(snap.automation.total) },
            { label: "Enabled rules", value: String(snap.automation.enabled) },
            { label: "Trigger conditions", value: snap.automation.triggers },
            { label: "Actions", value: snap.automation.actions },
            { label: "Destinations", value: snap.automation.destinations },
            { label: "Milestones", value: String(snap.automation.milestones) },
            { label: "Cooldowns", value: snap.automation.cooldowns },
          ]}
        />
      </SectionSummary>

      <EconomicsFlow tradingFeeBps={draft.fees.tradingFeeBps} allocations={snap.economics.allocations} />
      <AutomationTimeline automation={draft.automation} />
      <ValidationCenter draft={draft} onEdit={setStep} />
    </div>
  );
}

function TokenMarks({ imageUrl, bannerUrl }: { imageUrl: string; bannerUrl: string }) {
  return (
    <div className="w-full max-w-[180px] overflow-hidden rounded-2xl border border-white/10">
      <div className="h-16 bg-black/40">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="h-full bg-[radial-gradient(80%_120%_at_80%_0%,rgb(214_255_61/18%),transparent_55%)]" />
        )}
      </div>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="size-12 overflow-hidden rounded-xl border border-white/15 bg-ink">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <p className="flex h-full items-center justify-center font-mono text-[9px] uppercase text-white/35">Img</p>
          )}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Token image / banner</p>
      </div>
    </div>
  );
}
