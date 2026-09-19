"use client";

import { Field } from "@/components/custom-launch/field";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function TokenStep() {
  const { draft, patch, meta } = useCustomLaunch();
  const symbol = draft.token.symbol.trim().toUpperCase();

  return (
    <ControlPanel
      eyebrow="02 · Token"
      title="Identity of the instrument"
      body="Name, ticker, supply, and the public surface. Image is a URL preview in this phase — no upload desk is wired yet."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Ticker" value={symbol ? `$${symbol}` : "—"} tone={symbol ? "live" : "default"} />
        <MetricTile label="Decimals" value={String(draft.token.decimals)} hint={`${meta.longLabel} default`} />
        <MetricTile label="Supply" value={draft.token.supply || "—"} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Field label="Name">
          <Input
            value={draft.token.name}
            onChange={(event) => patch("token", { name: event.target.value })}
            placeholder="OrbitX"
          />
        </Field>
        <Field label="Ticker">
          <Input
            value={draft.token.symbol}
            onChange={(event) => patch("token", { symbol: event.target.value.toUpperCase().slice(0, 12) })}
            placeholder="ORBITX"
          />
        </Field>
        <Field label="Decimals">
          <Input
            type="number"
            min={0}
            max={18}
            value={draft.token.decimals}
            onChange={(event) =>
              patch("token", { decimals: Math.max(0, Math.min(18, Number(event.target.value) || 0)) })
            }
          />
        </Field>
        <Field label="Total supply">
          <Input
            value={draft.token.supply}
            onChange={(event) => patch("token", { supply: event.target.value.replace(/[^\d]/g, "") })}
            placeholder="1000000000"
          />
        </Field>
      </div>
      <Field className="mt-4" label="Description">
        <Textarea
          value={draft.token.description}
          onChange={(event) => patch("token", { description: event.target.value })}
          placeholder="What this token is for."
        />
      </Field>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_160px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Image URL" hint="Preview only. Nothing is uploaded.">
            <Input
              value={draft.token.imageUrl}
              onChange={(event) => patch("token", { imageUrl: event.target.value })}
              placeholder="https://"
            />
          </Field>
          <Field label="Website">
            <Input
              value={draft.token.website}
              onChange={(event) => patch("token", { website: event.target.value })}
              placeholder="https://"
            />
          </Field>
          <Field label="X">
            <Input
              value={draft.token.twitter}
              onChange={(event) => patch("token", { twitter: event.target.value })}
              placeholder="@handle"
            />
          </Field>
          <Field label="Telegram">
            <Input
              value={draft.token.telegram}
              onChange={(event) => patch("token", { telegram: event.target.value })}
              placeholder="t.me/"
            />
          </Field>
        </div>
        <div className="ox-console-metal flex items-center justify-center overflow-hidden rounded-2xl border border-white/10">
          {draft.token.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.token.imageUrl} alt="" className="h-36 w-full object-cover" />
          ) : (
            <p className="px-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
              No art
            </p>
          )}
        </div>
      </div>
    </ControlPanel>
  );
}
