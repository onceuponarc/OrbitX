"use client";

import { AdvancedMarket } from "@/components/custom-launch/advanced-market";
import { LiquiditySource } from "@/components/custom-launch/liquidity-source";
import { MarketAccess } from "@/components/custom-launch/market-access";
import { MarketCard } from "@/components/custom-launch/market-card";
import { PoolDesk } from "@/components/custom-launch/pool-desk";
import { QuoteSelect } from "@/components/custom-launch/quote-select";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import {
  createPoolConfig,
  estimatePool,
  LIQUIDITY_SOURCE_META,
  primaryMarketComplete,
} from "@/lib/custom-launch/markets";

export function PrimaryMarketStep() {
  const { draft, update } = useCustomLaunch();
  const { primary, access } = draft.markets;
  const estimate = estimatePool(primary.pool, primary.quote, draft.token.supply);
  const complete = primaryMarketComplete(draft.markets, draft.token.supply);

  return (
    <section className="space-y-4">
      <div className="ox-console rounded-[1.4rem] p-5 lg:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">04 · Primary Market</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Open the first book</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
          Choose the required primary market and size the intended pool. These are local estimates —
          no liquidity is posted and no pair is created.
        </p>
        {!complete ? (
          <p className="mt-3 text-sm text-heat">
            {!access.primaryEnabled
              ? "Enable the primary market to continue."
              : "Select a primary market and enter a valid liquidity amount."}
          </p>
        ) : null}
      </div>

      <div className="ox-console rounded-[1.35rem] p-5">
        <QuoteSelect
          value={primary.quote}
          symbol={draft.token.symbol}
          onChange={(quote) =>
            update((current) => ({
              ...current,
              markets: {
                ...current.markets,
                primary: {
                  ...current.markets.primary,
                  quote,
                  pool:
                    current.markets.primary.quote === quote
                      ? current.markets.primary.pool
                      : createPoolConfig(quote),
                },
                secondary: current.markets.secondary.filter((row) => row.quote !== quote),
              },
            }))
          }
        />
      </div>

      <div className="ox-console rounded-[1.35rem] p-5">
        <PoolDesk
          quote={primary.quote}
          pool={primary.pool}
          estimate={estimate}
          tokenLabel={draft.token.symbol ? `$${draft.token.symbol}` : "Token units"}
          onChange={(pool) =>
            update((current) => ({
              ...current,
              markets: {
                ...current.markets,
                primary: { ...current.markets.primary, pool: { ...current.markets.primary.pool, ...pool } },
              },
            }))
          }
        />
      </div>

      <div className="ox-console rounded-[1.35rem] p-5">
        <LiquiditySource
          value={primary.liquidity.source}
          onChange={(source) =>
            update((current) => ({
              ...current,
              markets: {
                ...current.markets,
                primary: { ...current.markets.primary, liquidity: { source } },
              },
            }))
          }
        />
      </div>

      <MarketCard
        symbol={draft.token.symbol}
        quote={primary.quote}
        role="primary"
        estimate={estimate}
        typeLabel={LIQUIDITY_SOURCE_META[primary.liquidity.source].title}
      />

      <div className="ox-console rounded-[1.35rem] p-5">
        <MarketAccess
          value={access}
          onChange={(next) =>
            update((current) => ({
              ...current,
              markets: { ...current.markets, access: { ...current.markets.access, ...next } },
            }))
          }
        />
      </div>

      <AdvancedMarket
        value={primary.advanced}
        onChange={(next) =>
          update((current) => ({
            ...current,
            markets: {
              ...current.markets,
              primary: { ...current.markets.primary, advanced: { ...current.markets.primary.advanced, ...next } },
            },
          }))
        }
      />
    </section>
  );
}
