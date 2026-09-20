"use client";

import { LIQUIDITY_SOURCES, LIQUIDITY_SOURCE_META, type LiquiditySourceId } from "@/lib/custom-launch/markets";
import { cn } from "@/lib/utils";

export function LiquiditySource({
  value,
  onChange,
}: {
  value: LiquiditySourceId;
  onChange: (next: LiquiditySourceId) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Launch book</p>
      <p className="mt-1 text-sm text-white/50">
        Custom Launch always opens a bonding curve. Canonical funded DEX pools are linked for the quote.
        The creator desk is not asked to deposit quote, and OrbitX does not seed LP.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {LIQUIDITY_SOURCES.map((id) => {
          const meta = LIQUIDITY_SOURCE_META[id];
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-all",
                active
                  ? "border-gold/50 bg-gold/10"
                  : "border-white/10 bg-black/20 text-white/70 hover:border-white/25 hover:text-white",
              )}
            >
              <p className="text-sm font-semibold text-white">{meta.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{meta.body}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
