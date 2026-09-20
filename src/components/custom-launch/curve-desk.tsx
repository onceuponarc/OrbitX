"use client";

import { MetricTile } from "@/components/custom-launch/panel";
import {
  customLaunchCurvePreview,
  CUSTOM_LAUNCH_CURVE,
} from "@/lib/custom-launch/curve";
import { formatEstimatePrice, formatEstimateUsd, type PrimaryQuoteId } from "@/lib/custom-launch/markets";
import { formatSupply } from "@/lib/custom-launch/token";

export function CurveDesk({
  quote,
  symbol,
  supply,
}: {
  quote: PrimaryQuoteId;
  symbol: string;
  supply: string;
}) {
  const curve = customLaunchCurvePreview({
    token: { supply, decimals: 9 },
    markets: { primary: { quote } },
  });
  const quoteLabel = quote === "usdc" ? "USDC" : "SOL";

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Custom bonding curve</p>
      <p className="mt-1 text-sm text-white/50">
        Opens automatically at launch with virtual reserves. Real {quoteLabel} starts at zero. Buyers fund
        the curve. Neither OrbitX nor the creator deposits LP. About {CUSTOM_LAUNCH_CURVE.tradableBps / 100}%
        of supply is tradable; {CUSTOM_LAUNCH_CURVE.lpReservedBps / 100}% is reserved for the DEX book at
        graduation.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Start cap" value={`${curve.startCapUi.toLocaleString("en-US")} ${quoteLabel}`} hint="Virtual" />
        <MetricTile label="Graduation" value={`${curve.graduateUi.toLocaleString("en-US")} ${quoteLabel}`} hint="Buyer-funded" />
        <MetricTile label="Start price" value={formatEstimatePrice(curve.startPriceUi)} hint={`${quoteLabel} / token`} />
        <MetricTile label="Virtual quote" value={formatEstimateUsd(curve.virtualQuoteUi * (quote === "usdc" ? 1 : 150))} hint="Looks like a full book" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricTile
          label="Tradable on curve"
          value={formatSupply(String(Math.round(curve.tradableUi)))}
          hint={symbol ? `$${symbol}` : "Tokens"}
        />
        <MetricTile
          label="Reserved for DEX LP"
          value={formatSupply(String(Math.round(curve.lpReservedUi)))}
          hint="Swept at graduation from the vault"
        />
      </div>
    </div>
  );
}
