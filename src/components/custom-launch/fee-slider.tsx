"use client";

import { Input } from "@/components/ui/input";
import { clampTradingFeeBps, MAX_TRADING_FEE_BPS } from "@/lib/custom-launch/fees";
import { formatBps } from "@/lib/custom-launch/schema";
import { InfoTip } from "@/components/custom-launch/field";

export function FeeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (bps: number) => void;
}) {
  const pct = value / 100;

  return (
    <section className="ox-console rounded-[1.35rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Trading fee</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Configured take on each trade</h3>
        </div>
        <InfoTip text="This is the fee the Custom Launch trading infrastructure will eventually use. It is not live from this screen." />
      </div>
      <p className="mt-5 font-display text-5xl tracking-tight text-gold">{formatBps(value)}</p>
      <p className="mt-1 text-xs text-white/40">Maximum {formatBps(MAX_TRADING_FEE_BPS)}. Not active yet.</p>
      <input
        type="range"
        min={0}
        max={MAX_TRADING_FEE_BPS}
        step={5}
        value={value}
        onChange={(event) => onChange(clampTradingFeeBps(Number(event.target.value)))}
        className="mt-5 w-full accent-[#d6ff3d]"
      />
      <div className="mt-3 flex items-center gap-3">
        <Input
          type="number"
          min={0}
          max={5}
          step={0.05}
          value={pct.toString()}
          onChange={(event) => onChange(clampTradingFeeBps(Number(event.target.value) * 100))}
          className="w-24"
        />
        <span className="text-sm text-white/45">percent</span>
      </div>
    </section>
  );
}
