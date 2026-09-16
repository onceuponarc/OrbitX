import { cn } from "@/lib/utils";
import { formatUsd, timeAgo } from "@/lib/format";
import type { ChartTrade } from "@/lib/chart";

export type { ChartTrade };

export function HoldersTable({
  holders,
}: {
  holders: { address: string; bought: number; sold: number; net: number }[];
}) {
  if (!holders.length) {
    return (
      <div className="glass rounded-2xl border border-arc/15 px-4 py-8 text-center text-sm text-parchment/55">
        No holders yet. The first buy creates the book.
      </div>
    );
  }
  return (
    <div className="glass overflow-hidden rounded-2xl border border-arc/15">
      <div className="border-b border-white/5 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">Holders</p>
      </div>
      <ul className="divide-y divide-white/5">
        {holders.map((row) => (
          <li key={row.address} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="font-mono text-xs text-parchment/70">
              {row.address.slice(0, 6)}…{row.address.slice(-4)}
            </span>
            <span className={cn("tabular-nums", row.net >= 0 ? "text-buy" : "text-sell")}>
              {row.net.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StoryTape({ trades }: { trades: ChartTrade[] }) {
  if (!trades.length) {
    return (
      <div className="glass rounded-2xl border border-arc/15 px-4 py-8 text-center text-sm text-parchment/55">
        Buys and sells print here the moment they land.
      </div>
    );
  }
  return (
    <div className="glass overflow-hidden rounded-2xl border border-arc/15">
      <div className="border-b border-white/5 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">Buys & sells</p>
      </div>
      <ul className="max-h-80 divide-y divide-white/5 overflow-auto">
        {[...trades].reverse().map((trade, index) => (
          <li key={`${trade.at}-${index}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className={cn("font-semibold uppercase", trade.side === "buy" ? "text-buy" : "text-sell")}>
              {trade.side}
            </span>
            <span className="tabular-nums text-parchment/80">{formatUsd(trade.quoteUi)}</span>
            <span className="text-xs text-parchment/40">{timeAgo(trade.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
