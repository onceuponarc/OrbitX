"use client";

import { AdvancedMarket } from "@/components/custom-launch/advanced-market";
import { CurveDesk } from "@/components/custom-launch/curve-desk";
import { LinkedPools } from "@/components/custom-launch/linked-pools";
import { LiquiditySource } from "@/components/custom-launch/liquidity-source";
import { MarketAccess } from "@/components/custom-launch/market-access";
import { MarketCard } from "@/components/custom-launch/market-card";
import { QuoteSelect } from "@/components/custom-launch/quote-select";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import {
  LIQUIDITY_SOURCE_META,
  primaryEstimate,
  primaryMarketError,
} from "@/lib/custom-launch/markets";

export function PrimaryMarketStep() {
  const { draft, update } = useCustomLaunch();
  const { primary, access } = draft.markets;
  const estimate = primaryEstimate(draft.markets, draft.token.supply);
  const error = primaryMarketError(draft.markets, draft.token.supply);

  return (
    <section className="space-y-4">
      <div className="ox-console rounded-[1.4rem] p-5 lg:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">04 · Primary Market</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Open the bonding curve</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
          Choose the primary quote. A custom bonding curve opens at launch and real funded DEX books for
          that quote are linked automatically. Neither OrbitX nor the creator deposits liquidity. You do not deposit SOL or USDC.
        </p>
        {error ? <p className="mt-3 text-sm text-heat">{error}</p> : null}
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
                },
                secondary: current.markets.secondary.filter((row) => row.quote !== quote),
              },
            }))
          }
        />
      </div>

      <div className="ox-console rounded-[1.35rem] p-5">
        <CurveDesk quote={primary.quote} symbol={draft.token.symbol} supply={draft.token.supply} />
      </div>

      <div className="ox-console rounded-[1.35rem] p-5">
        <LinkedPools chain={draft.chain} quote={primary.quote} />
      </div>

      <div className="ox-console rounded-[1.35rem] p-5">
        <LiquiditySource
          value={primary.liquidity.source}
          onChange={(source) =>
            update((current) => ({
              ...current,
              markets: {
                ...current.markets,
                primary: {
                  ...current.markets.primary,
                  liquidity: { source },
                  pool: {
                    ...current.markets.primary.pool,
                    pairedAmount: "0",
                  },
                },
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
