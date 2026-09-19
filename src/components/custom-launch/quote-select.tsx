"use client";

import {
  pairLabel,
  PRIMARY_QUOTES,
  QUOTE_ASSETS,
  tokenTicker,
  type PrimaryQuoteId,
} from "@/lib/custom-launch/markets";
import { cn } from "@/lib/utils";

export function QuoteSelect({
  value,
  symbol,
  onChange,
}: {
  value: PrimaryQuoteId;
  symbol: string;
  onChange: (next: PrimaryQuoteId) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Primary market</p>
      <p className="mt-1 text-sm text-white/50">
        The initial market used for the Custom Launch. Choose one quote asset.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PRIMARY_QUOTES.map((id) => {
          const asset = QUOTE_ASSETS[id];
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "min-h-[140px] rounded-[1.3rem] border px-5 py-5 text-left transition-all",
                active
                  ? "border-gold/55 bg-gold/10 shadow-[0_0_0_1px_rgb(214_255_61/25%)_inset]"
                  : "border-white/10 bg-black/20 text-white/70 hover:border-white/25 hover:text-white",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-3xl font-semibold tracking-tight text-white">{asset.ticker}</span>
                {active ? (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                    Primary
                  </span>
                ) : null}
              </span>
              <span className="mt-2 block text-sm text-white/55">{asset.body}</span>
              <span className="mt-4 block font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">
                {pairLabel(symbol, id)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Token</p>
          <p className="mt-1 text-lg font-semibold">{tokenTicker(symbol)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Pair</p>
          <p className="mt-1 text-lg font-semibold">{pairLabel(symbol, value)}</p>
        </div>
        <p className="text-xs text-white/40 sm:col-span-2">Mock pair. No book is opened from this screen.</p>
      </div>
    </div>
  );
}
