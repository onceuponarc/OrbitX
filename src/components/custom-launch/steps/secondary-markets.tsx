"use client";

import { useState } from "react";
import { MarketCard } from "@/components/custom-launch/market-card";
import { MarketRouter } from "@/components/custom-launch/market-router";
import { PoolDesk } from "@/components/custom-launch/pool-desk";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/custom-launch/field";
import { MetricTile } from "@/components/custom-launch/panel";
import {
  availableSecondaryQuotes,
  configuredMarketCount,
  createSecondaryMarket,
  estimatePool,
  formatEstimatePrice,
  formatEstimateUsd,
  LIQUIDITY_SOURCE_META,
  pairLabel,
  primaryEstimate,
  QUOTE_ASSETS,
  secondaryMarketError,
  type QuoteAssetId,
} from "@/lib/custom-launch/markets";
import { cn } from "@/lib/utils";

export function SecondaryMarketsStep() {
  const { draft, update } = useCustomLaunch();
  const { markets } = draft;
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [customTicker, setCustomTicker] = useState("");
  const available = availableSecondaryQuotes(markets);
  const primaryEst = primaryEstimate(markets, draft.token.supply);
  const configured = configuredMarketCount(markets, draft.token.supply);

  function addMarket(quote: QuoteAssetId) {
    if (quote === "other" && !customTicker.trim()) return;
    if (
      quote === "other" &&
      markets.secondary.some((row) => row.quote === "other" && row.customTicker === customTicker.trim().toUpperCase())
    ) {
      return;
    }
    const next = createSecondaryMarket(quote, customTicker.trim().toUpperCase());
    update((current) => ({
      ...current,
      markets: { ...current.markets, secondary: [...current.markets.secondary, next] },
    }));
    setAdding(false);
    setCustomTicker("");
    setOpenId(next.id);
  }

  return (
    <section className="space-y-4">
      <div className="ox-console rounded-[1.4rem] p-5 lg:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">05 · Secondary Markets</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Widen the tape</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
          Primary is required. Secondary books are optional and can be added, configured, or removed.
          No venue is connected from this desk.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile
          label="Primary market"
          value={pairLabel(draft.token.symbol, markets.primary.quote)}
          hint="Required"
          tone="live"
        />
        <MetricTile
          label="Starting liquidity"
          value={formatEstimateUsd(primaryEst.liquidityUsd)}
          hint="Estimate"
        />
        <MetricTile
          label="Initial price"
          value={formatEstimatePrice(primaryEst.initialPrice)}
          hint="Estimate"
        />
      </div>

      <MarketCard
        symbol={draft.token.symbol}
        quote={markets.primary.quote}
        role="primary"
        estimate={primaryEst}
        typeLabel={LIQUIDITY_SOURCE_META[markets.primary.liquidity.source].title}
      />

      <div className="ox-console rounded-[1.35rem] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Secondary markets</p>
            <h3 className="mt-1 text-lg font-semibold">Optional additional books</h3>
            <p className="mt-1 text-sm text-white/45">
              BTC, ETH, SOL, USDC, or another supported asset — excluding the primary pair.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setAdding((value) => !value)}>
            {adding ? "Close" : "Add market"}
          </Button>
        </div>

        {adding ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((id) => {
                const asset = QUOTE_ASSETS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => (id === "other" ? undefined : addMarket(id))}
                    className={cn(
                      "rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left hover:border-white/25",
                      id === "other" && "pointer-events-none opacity-80",
                    )}
                  >
                    <p className="text-sm font-semibold">{asset.ticker}</p>
                    <p className="mt-1 text-xs text-white/45">{asset.body}</p>
                  </button>
                );
              })}
            </div>
            {available.includes("other") ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Custom quote ticker" className="min-w-[160px] flex-1">
                  <Input
                    value={customTicker}
                    onChange={(event) => setCustomTicker(event.target.value.toUpperCase().slice(0, 8))}
                    placeholder="BTC"
                  />
                </Field>
                <Button type="button" disabled={!customTicker.trim()} onClick={() => addMarket("other")}>
                  Add custom market
                </Button>
              </div>
            ) : null}
            {available.length === 0 ? (
              <p className="text-sm text-white/45">Every supported secondary quote is already on the draft.</p>
            ) : null}
          </div>
        ) : null}

        {markets.secondary.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/45">
            No secondary markets yet. The launch can stay primary-only.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {markets.secondary.map((row) => {
              const estimate = estimatePool(row.pool, row.quote, draft.token.supply, row.customTicker);
              const error = secondaryMarketError(row, markets.secondary, markets.primary.quote);
              const open = openId === row.id;
              return (
                <div key={row.id} className="space-y-3">
                  <MarketCard
                    symbol={draft.token.symbol}
                    quote={row.quote}
                    customTicker={row.customTicker}
                    role="secondary"
                    estimate={estimate}
                    typeLabel={error ?? "Optional book"}
                    onConfigure={() => setOpenId(open ? null : row.id)}
                    onRemove={() =>
                      update((current) => ({
                        ...current,
                        markets: {
                          ...current.markets,
                          secondary: current.markets.secondary.filter((item) => item.id !== row.id),
                        },
                      }))
                    }
                  />
                  {open ? (
                    <div className="rounded-[1.25rem] border border-white/10 p-4">
                      {row.quote === "other" ? (
                        <Field label="Custom quote ticker" className="mb-4 max-w-xs">
                          <Input
                            value={row.customTicker}
                            onChange={(event) =>
                              update((current) => ({
                                ...current,
                                markets: {
                                  ...current.markets,
                                  secondary: current.markets.secondary.map((item) =>
                                    item.id === row.id
                                      ? { ...item, customTicker: event.target.value.toUpperCase().slice(0, 8) }
                                      : item,
                                  ),
                                },
                              }))
                            }
                          />
                        </Field>
                      ) : null}
                      <PoolDesk
                        quote={row.quote}
                        customTicker={row.customTicker}
                        pool={row.pool}
                        estimate={estimate}
                        tokenLabel={draft.token.symbol ? `$${draft.token.symbol}` : "Token units"}
                        onChange={(pool) =>
                          update((current) => ({
                            ...current,
                            markets: {
                              ...current.markets,
                              secondary: current.markets.secondary.map((item) =>
                                item.id === row.id ? { ...item, pool: { ...item.pool, ...pool } } : item,
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Secondary markets" value={String(markets.secondary.length)} />
        <MetricTile label="Total configured markets" value={String(configured)} />
        <MetricTile
          label="Later connections"
          value={markets.access.laterConnections ? "Open" : "Closed"}
          hint="Access flag only"
        />
      </div>

      <MarketRouter markets={markets} symbol={draft.token.symbol} />
    </section>
  );
}
