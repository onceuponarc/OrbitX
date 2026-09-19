"use client";

import { ChoiceGrid } from "@/components/custom-launch/choice-grid";
import { Field, ToggleRow } from "@/components/custom-launch/field";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { formatBps } from "@/lib/custom-launch/schema";
import { Input } from "@/components/ui/input";

export function TradingEconomicsStep() {
  const { draft, patch, meta } = useCustomLaunch();
  const { economics } = draft;

  return (
    <ControlPanel
      eyebrow="03 · Trading Economics"
      title="Fee stack and flow limits"
      body="Set how every trade is split, who captures the creator share, and the hard limits on wallet and ticket size. These numbers stay local until a later phase can bind them on-chain."
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricTile label="Quote" value={economics.quote === "usdc" ? "USDC" : meta.native} tone="live" />
        <MetricTile label="Buy fee" value={formatBps(economics.buyFeeBps)} />
        <MetricTile label="Sell fee" value={formatBps(economics.sellFeeBps)} />
        <MetricTile label="Creator share" value={formatBps(economics.creatorShareBps)} />
      </div>
      <div className="mt-5">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Quote asset</p>
        <ChoiceGrid
          columns={2}
          value={economics.quote}
          onChange={(quote) => patch("economics", { quote })}
          options={[
            { id: "native", title: meta.native, body: `Native ${meta.longLabel} quote` },
            { id: "usdc", title: "USDC", body: "Stable quote when the venue supports it" },
          ]}
        />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BpsField
          label="Buy fee"
          value={economics.buyFeeBps}
          max={1000}
          onChange={(buyFeeBps) => patch("economics", { buyFeeBps })}
        />
        <BpsField
          label="Sell fee"
          value={economics.sellFeeBps}
          max={1000}
          onChange={(sellFeeBps) => patch("economics", { sellFeeBps })}
        />
        <BpsField
          label="Creator share of fees"
          value={economics.creatorShareBps}
          max={10_000}
          onChange={(creatorShareBps) => patch("economics", { creatorShareBps })}
        />
        <BpsField
          label="Max wallet"
          value={economics.maxWalletBps}
          max={10_000}
          onChange={(maxWalletBps) => patch("economics", { maxWalletBps })}
        />
        <BpsField
          label="Max transaction"
          value={economics.maxTxBps}
          max={10_000}
          onChange={(maxTxBps) => patch("economics", { maxTxBps })}
        />
      </div>
      <div className="mt-5">
        <ToggleRow
          label="Transfer restriction"
          body="Holders can only route through the configured markets. Desk-only flag in this phase."
          checked={economics.transferRestricted}
          onCheckedChange={(transferRestricted) => patch("economics", { transferRestricted })}
        />
      </div>
    </ControlPanel>
  );
}

function BpsField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <Field label={label} hint={`Up to ${formatBps(max)}`}>
      <Input
        type="number"
        min={0}
        max={max / 100}
        step={0.1}
        value={(value / 100).toString()}
        onChange={(event) => {
          const pct = Number(event.target.value);
          const bps = Number.isFinite(pct) ? Math.round(Math.max(0, Math.min(max, pct * 100))) : 0;
          onChange(bps);
        }}
      />
    </Field>
  );
}
