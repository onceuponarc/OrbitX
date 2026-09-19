"use client";

import { Button } from "@/components/ui/button";
import {
  formatEstimatePrice,
  formatEstimateUsd,
  marketStatus,
  pairLabel,
  type MarketRole,
  type PoolEstimate,
} from "@/lib/custom-launch/markets";
import { cn } from "@/lib/utils";

export function MarketCard({
  symbol,
  quote,
  customTicker,
  role,
  estimate,
  typeLabel,
  onConfigure,
  onRemove,
}: {
  symbol: string;
  quote: Parameters<typeof pairLabel>[1];
  customTicker?: string;
  role: MarketRole;
  estimate: PoolEstimate;
  typeLabel: string;
  onConfigure?: () => void;
  onRemove?: () => void;
}) {
  const status = marketStatus(estimate);
  return (
    <article
      className={cn(
        "rounded-[1.25rem] border px-4 py-4",
        role === "primary" ? "border-gold/35 bg-gold/6" : "border-white/10 bg-black/20",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            {role === "primary" ? "Primary market" : "Secondary market"}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{pairLabel(symbol, quote, customTicker)}</h3>
          <p className="mt-1 text-xs text-white/40">{typeLabel}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
            status === "ready" && "bg-buy/12 text-buy",
            status === "incomplete" && "bg-heat/12 text-heat",
            status === "not_configured" && "bg-white/8 text-white/45",
          )}
        >
          {status === "ready" ? "Ready" : status === "incomplete" ? "Incomplete" : "Not configured"}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Status</dt>
          <dd className="mt-0.5">{status === "ready" ? "Ready" : status === "incomplete" ? "Incomplete" : "Not configured"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Type</dt>
          <dd className="mt-0.5">{typeLabel}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Liquidity</dt>
          <dd className="mt-0.5 tabular-nums">{formatEstimateUsd(estimate.liquidityUsd)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Initial price</dt>
          <dd className="mt-0.5 tabular-nums">{formatEstimatePrice(estimate.initialPrice)}</dd>
        </div>
      </dl>
      {estimate.error ? <p className="mt-3 text-xs text-heat">{estimate.error}</p> : null}
      {onConfigure || onRemove ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onConfigure ? (
            <Button type="button" size="sm" variant="outline" onClick={onConfigure}>
              Configure
            </Button>
          ) : null}
          {onRemove ? (
            <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
