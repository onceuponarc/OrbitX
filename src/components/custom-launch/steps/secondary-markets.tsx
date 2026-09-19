"use client";

import { Field, ToggleRow } from "@/components/custom-launch/field";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { formatBps } from "@/lib/custom-launch/schema";
import { Input } from "@/components/ui/input";

export function SecondaryMarketsStep() {
  const { draft, patch, meta } = useCustomLaunch();
  const { secondary } = draft;

  return (
    <ControlPanel
      eyebrow="05 · Secondary Markets"
      title="Where it trades after the open"
      body="Name the pair, the seed, the lock, and the fee tier. This screen does not create a pool or move funds — it only records the intended secondary structure."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Pair" value={secondary.listOnDex ? secondary.quotePair || "—" : "Off"} />
        <MetricTile
          label="Seed"
          value={secondary.seedLiquidity ? `${secondary.seedLiquidity} ${meta.quote}` : "—"}
        />
        <MetricTile label="LP lock" value={secondary.listOnDex ? `${secondary.lpLockDays}d` : "—"} />
      </div>
      <div className="mt-5 space-y-3">
        <ToggleRow
          label="List on the venue DEX"
          body={`${meta.venue}. Toggle off if this print should stay primary-only for now.`}
          checked={secondary.listOnDex}
          onCheckedChange={(listOnDex) => patch("secondary", { listOnDex })}
        />
      </div>
      {secondary.listOnDex ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Quote pair">
            <Input
              value={secondary.quotePair}
              onChange={(event) => patch("secondary", { quotePair: event.target.value })}
              placeholder={`${meta.short}/${meta.quote}`}
            />
          </Field>
          <Field label={`Seed liquidity (${meta.quote})`}>
            <Input
              value={secondary.seedLiquidity}
              onChange={(event) => patch("secondary", { seedLiquidity: event.target.value })}
              placeholder="0"
            />
          </Field>
          <Field label="LP lock (days)">
            <Input
              type="number"
              min={0}
              max={1825}
              value={secondary.lpLockDays}
              onChange={(event) =>
                patch("secondary", { lpLockDays: Math.max(0, Math.min(1825, Number(event.target.value) || 0)) })
              }
            />
          </Field>
          <Field label="Fee tier" hint={formatBps(secondary.feeTierBps)}>
            <Input
              type="number"
              min={1}
              max={100}
              step={1}
              value={(secondary.feeTierBps / 100).toString()}
              onChange={(event) => {
                const pct = Number(event.target.value);
                const feeTierBps = Number.isFinite(pct)
                  ? Math.round(Math.max(1, Math.min(100, pct)) * 100)
                  : 30;
                patch("secondary", { feeTierBps });
              }}
            />
          </Field>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/50">
          Secondary listing is off. The draft will not include a DEX pair until you turn it back on.
        </p>
      )}
    </ControlPanel>
  );
}
