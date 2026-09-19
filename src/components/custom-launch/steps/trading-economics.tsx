"use client";

import { FeeAllocationBuilder } from "@/components/custom-launch/fee-allocation";
import { FeeEconomicsPreview } from "@/components/custom-launch/fee-economics-preview";
import { FeeRouter } from "@/components/custom-launch/fee-router";
import { FeeSlider } from "@/components/custom-launch/fee-slider";
import { ProtocolDestination } from "@/components/custom-launch/protocol-destination";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { feeAllocationsOver, resolvedFeeAllocations } from "@/lib/custom-launch/fees";
import { launchModeSummary } from "@/lib/custom-launch/modes";

export function TradingEconomicsStep() {
  const { draft, patch } = useCustomLaunch();
  const allocations = resolvedFeeAllocations(draft.mode, draft.fees);
  const over = feeAllocationsOver(allocations);

  return (
    <section className="space-y-4">
      <div className="ox-console rounded-[1.4rem] p-5 lg:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">03 · Trading Economics</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Fee stack for the print</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
          Set the trading fee and how that pot is split. Destinations follow {launchModeSummary(draft.mode)}.
          These numbers are a local configuration, not a live market.
        </p>
      </div>

      <FeeSlider
        value={draft.fees.tradingFeeBps}
        onChange={(tradingFeeBps) => patch("fees", { tradingFeeBps })}
      />
      <ProtocolDestination />
      <FeeAllocationBuilder
        allocations={allocations}
        onChange={(id, bps) => {
          if (id === "orbitx") return;
          patch("fees", { shares: { ...draft.fees.shares, [id]: bps } });
        }}
      />
      {over ? null : <FeeEconomicsPreview tradingFeeBps={draft.fees.tradingFeeBps} allocations={allocations} />}
      <FeeRouter allocations={allocations} />
    </section>
  );
}
