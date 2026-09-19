"use client";

import { useState } from "react";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { ORBITX_PROTOCOL } from "@/lib/custom-launch/protocol";
import { resolvedFeeAllocations } from "@/lib/custom-launch/fees";
import {
  configuredMarketCount,
  formatEstimatePrice,
  formatEstimateUsd,
  pairLabel,
  primaryEstimate,
} from "@/lib/custom-launch/markets";
import { formatBps, launchModeTitle } from "@/lib/custom-launch/schema";
import { formatSupply } from "@/lib/custom-launch/token";
import { cn } from "@/lib/utils";

export function LaunchSummary({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const { draft } = useCustomLaunch();
  const [open, setOpen] = useState(false);
  const allocations = resolvedFeeAllocations(draft.mode, draft.fees);
  const symbol = draft.token.symbol.trim().toUpperCase();
  const estimate = primaryEstimate(draft.markets, draft.token.supply);
  const secondaryCount = draft.markets.secondary.length;
  const automation =
    draft.automation.rules.length === 0
      ? "Not configured yet"
      : `${draft.automation.rules.length} rule${draft.automation.rules.length === 1 ? "" : "s"}`;

  const rows = [
    ["Token", symbol ? `$${symbol}` : "—"],
    ["Supply", formatSupply(draft.token.supply)],
    ["Trading fee", formatBps(draft.fees.tradingFeeBps)],
    ["OrbitX allocation", formatBps(ORBITX_PROTOCOL.allocationBps)],
    ["Selected mode", launchModeTitle(draft.mode)],
    ["Fee destinations", String(allocations.length)],
    ["Primary market", pairLabel(draft.token.symbol, draft.markets.primary.quote)],
    ["Starting liquidity", formatEstimateUsd(estimate.liquidityUsd)],
    ["Initial price", formatEstimatePrice(estimate.initialPrice)],
    ["Secondary markets", String(secondaryCount)],
    ["Total configured markets", String(configuredMarketCount(draft.markets, draft.token.supply))],
    ["Automation", automation],
  ];

  if (variant === "mobile") {
    return (
      <section className="ox-console rounded-[1.2rem] lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Live summary</span>
            <span className="text-sm font-semibold">
              {symbol ? `$${symbol}` : "Token"} · {pairLabel(draft.token.symbol, draft.markets.primary.quote)}
            </span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            {open ? "Hide" : "Show"}
          </span>
        </button>
        {open ? <SummaryRows rows={rows} /> : null}
      </section>
    );
  }

  return (
    <aside className={cn("ox-console hidden w-[260px] shrink-0 rounded-[1.4rem] p-4 lg:sticky lg:top-4 lg:block")}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Live summary</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">Desk tape</h3>
      <SummaryRows rows={rows} />
    </aside>
  );
}

function SummaryRows({ rows }: { rows: string[][] }) {
  return (
    <dl className="space-y-3 px-4 pb-4 lg:mt-4 lg:px-0 lg:pb-0">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</dt>
          <dd className="mt-0.5 truncate text-sm text-white/80">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
