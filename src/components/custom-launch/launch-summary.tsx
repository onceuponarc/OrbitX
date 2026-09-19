"use client";

import { useState } from "react";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { reviewSnapshot } from "@/lib/custom-launch/review";
import { cn } from "@/lib/utils";

export function LaunchSummary({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const { draft } = useCustomLaunch();
  const [open, setOpen] = useState(false);
  const snap = reviewSnapshot(draft);

  const rows = [
    ["Token", snap.token.symbol],
    ["Chain", snap.chain.label],
    ["Primary market", snap.market.quote],
    ["Liquidity", snap.market.liquidity],
    ["Trading fee", snap.economics.tradingFee],
    ["OrbitX", snap.economics.orbitx],
    ["Creator", snap.economics.creator],
    ["Automation", `${snap.automation.total} RULES`],
    ["Status", snap.statusLabel],
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
              {snap.token.ticker ? snap.token.symbol : "Token"} · {snap.market.quote}
            </span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            {open ? "Hide" : "Show"}
          </span>
        </button>
        {open ? <SummaryRows rows={rows} ready={snap.ready} /> : null}
      </section>
    );
  }

  return (
    <aside className={cn("ox-console hidden w-[260px] shrink-0 rounded-[1.4rem] p-4 lg:sticky lg:top-4 lg:block")}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Live summary</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">Desk tape</h3>
      <SummaryRows rows={rows} ready={snap.ready} />
    </aside>
  );
}

function SummaryRows({ rows, ready }: { rows: string[][]; ready: boolean }) {
  return (
    <dl className="space-y-3 px-4 pb-4 lg:mt-4 lg:px-0 lg:pb-0">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</dt>
          <dd
            className={cn(
              "mt-0.5 truncate text-sm text-white/80",
              label === "Status" && (ready ? "text-buy" : "text-heat"),
            )}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
