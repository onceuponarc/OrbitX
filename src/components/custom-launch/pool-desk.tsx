"use client";

import { Field } from "@/components/custom-launch/field";
import { MetricTile } from "@/components/custom-launch/panel";
import { Input } from "@/components/ui/input";
import {
  formatEstimatePrice,
  formatEstimateUsd,
  formatRatio,
  liquidityAllocationPct,
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
  totalSupply,
  onChange,
  quoteLocked = false,
}: {
  quote: QuoteAssetId;
  customTicker?: string;
  pool: PoolConfig;
  estimate: PoolEstimate;
  tokenLabel: string;
  totalSupply?: string;
  onChange: (next: Partial<PoolConfig>) => void;
  quoteLocked?: boolean;
}) {
  const quoteLabel = quoteTicker(quote, customTicker);
  const allocatedPct = liquidityAllocationPct(pool.tokenAllocation, totalSupply ?? "");

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Pool configuration</p>
      <p className="mt-1 text-sm text-white/50">
        Size the token side. OrbitX posts the quote and opens the public book at launch — you do not deposit
        SOL or USDC.
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
          label={`OrbitX ${quoteLabel} seed`}
          error={estimate.error && !Number(pool.pairedAmount) ? estimate.error : undefined}
          hint={quoteLocked ? "Protocol inventory. Not taken from your desk." : undefined}
        >
          <Input
            value={pool.pairedAmount}
            readOnly={quoteLocked}
            aria-invalid={Boolean(estimate.error && !Number(pool.pairedAmount))}
            onChange={(event) => {
              if (quoteLocked) return;
              onChange({ pairedAmount: event.target.value.replace(/[^\d.]/g, "") });
            }}
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
      {totalSupply ? (
        <div className="mt-4">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            <span>Liquidity allocation</span>
            <span>{allocatedPct.toFixed(allocatedPct % 1 ? 1 : 0)}% of supply</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gold transition-all duration-500"
              style={{ width: `${Math.max(allocatedPct > 0 ? 4 : 0, Math.min(100, allocatedPct))}%` }}
            />
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-white/40">
        Price impact preview (estimate): a $100 buy would move the mock book about{" "}
        <span className="text-white/70">{estimate.valid ? `${(estimate.impactBps / 100).toFixed(2)}%` : "—"}</span>.
        Not a live quote.
      </p>
    </div>
  );
}
