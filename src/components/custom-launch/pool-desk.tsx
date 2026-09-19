"use client";

import { Field } from "@/components/custom-launch/field";
import { MetricTile } from "@/components/custom-launch/panel";
import { Input } from "@/components/ui/input";
import {
  formatEstimatePrice,
  formatEstimateUsd,
  formatRatio,
  quoteTicker,
  type PoolConfig,
  type PoolEstimate,
  type QuoteAssetId,
} from "@/lib/custom-launch/markets";

export function PoolDesk({
  quote,
  customTicker,
  pool,
  estimate,
  tokenLabel,
  onChange,
}: {
  quote: QuoteAssetId;
  customTicker?: string;
  pool: PoolConfig;
  estimate: PoolEstimate;
  tokenLabel: string;
  onChange: (next: Partial<PoolConfig>) => void;
}) {
  const quoteLabel = quoteTicker(quote, customTicker);

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Pool configuration</p>
      <p className="mt-1 text-sm text-white/50">
        Local estimates only. OrbitX does not size or seed a pool from these fields.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Initial token allocation"
          error={estimate.error && !Number(pool.tokenAllocation) ? estimate.error : undefined}
          hint={tokenLabel}
        >
          <Input
            value={pool.tokenAllocation}
            aria-invalid={Boolean(estimate.error && !Number(pool.tokenAllocation))}
            onChange={(event) => onChange({ tokenAllocation: event.target.value.replace(/[^\d.]/g, "") })}
            placeholder="200000000"
          />
        </Field>
        <Field
          label={`Initial paired ${quoteLabel}`}
          error={estimate.error && !Number(pool.pairedAmount) ? estimate.error : undefined}
        >
          <Input
            value={pool.pairedAmount}
            aria-invalid={Boolean(estimate.error && !Number(pool.pairedAmount))}
            onChange={(event) => onChange({ pairedAmount: event.target.value.replace(/[^\d.]/g, "") })}
            placeholder="0"
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Initial price" value={formatEstimatePrice(estimate.initialPrice)} hint="Estimate" />
        <MetricTile label="Starting liquidity" value={formatEstimateUsd(estimate.liquidityUsd)} hint="Both sides · estimate" />
        <MetricTile
          label="Token / pair ratio"
          value={formatRatio(estimate.tokenAmount, estimate.pairedAmount, quoteLabel)}
          hint="UI only"
        />
        <MetricTile
          label="Est. starting mcap"
          value={formatEstimateUsd(estimate.marketCapUsd)}
          hint="Supply × estimated price"
        />
      </div>
      <p className="mt-3 text-xs text-white/40">
        Price impact preview (estimate): a $100 buy would move the mock book about{" "}
        <span className="text-white/70">{estimate.valid ? `${(estimate.impactBps / 100).toFixed(2)}%` : "—"}</span>.
        Not a live quote.
      </p>
    </div>
  );
}
