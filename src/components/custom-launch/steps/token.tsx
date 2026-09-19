"use client";

import { Field } from "@/components/custom-launch/field";
import { SupplyBreakdown } from "@/components/custom-launch/supply-breakdown";
import { TokenPreview } from "@/components/custom-launch/token-preview";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatSupply, validateTokenConfig } from "@/lib/custom-launch/token";

export function TokenStep() {
  const { draft, patch } = useCustomLaunch();
  const errors = validateTokenConfig(draft.token);

  function setToken<K extends keyof typeof draft.token>(key: K, value: (typeof draft.token)[K]) {
    patch("token", { [key]: value } as Partial<typeof draft.token>);
  }

  function readImage(key: "imageUrl" | "bannerUrl", file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setToken(key, String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <section className="space-y-4">
      <div className="ox-console rounded-[1.4rem] p-5 lg:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">02 · Token</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Identity of the instrument</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
          Configure the token the desk will eventually print. Images stay local. Nothing is uploaded
          or minted from this screen.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="ox-console grid gap-4 rounded-[1.35rem] p-4 sm:grid-cols-2">
            <Field label="Token name" error={errors.name}>
              <Input
                value={draft.token.name}
                aria-invalid={Boolean(errors.name)}
                onChange={(event) => setToken("name", event.target.value)}
                placeholder="OrbitX"
              />
            </Field>
            <Field label="Token symbol" error={errors.symbol} info="2–12 letters or numbers. Stored uppercase.">
              <Input
                value={draft.token.symbol}
                aria-invalid={Boolean(errors.symbol)}
                onChange={(event) => setToken("symbol", event.target.value.toUpperCase().slice(0, 12))}
                placeholder="ORBITX"
              />
            </Field>
            <Field label="Total supply" error={errors.supply} hint={formatSupply(draft.token.supply)}>
              <Input
                value={draft.token.supply}
                aria-invalid={Boolean(errors.supply)}
                onChange={(event) => setToken("supply", event.target.value.replace(/[^\d]/g, ""))}
                placeholder="1000000000"
              />
            </Field>
            <Field label="Decimals" error={errors.decimals} info="Usually 6–9 on Solana, 18 on EVM.">
              <Input
                type="number"
                min={0}
                max={18}
                value={draft.token.decimals}
                aria-invalid={Boolean(errors.decimals)}
                onChange={(event) =>
                  setToken("decimals", Math.max(0, Math.min(18, Number(event.target.value) || 0)))
                }
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea
                value={draft.token.description}
                onChange={(event) => setToken("description", event.target.value)}
                placeholder="What this token is for."
              />
            </Field>
          </div>

          <div className="ox-console grid gap-4 rounded-[1.35rem] p-4 sm:grid-cols-2">
            <Field label="Token image" error={errors.imageUrl} hint="URL or local preview. Not uploaded.">
              <Input
                value={draft.token.imageUrl.startsWith("data:") ? "" : draft.token.imageUrl}
                aria-invalid={Boolean(errors.imageUrl)}
                onChange={(event) => setToken("imageUrl", event.target.value)}
                placeholder="https://"
              />
              <input
                type="file"
                accept="image/*"
                className="mt-2 text-xs text-white/45"
                onChange={(event) => readImage("imageUrl", event.target.files?.[0])}
              />
            </Field>
            <Field label="Banner / cover" error={errors.bannerUrl}>
              <Input
                value={draft.token.bannerUrl.startsWith("data:") ? "" : draft.token.bannerUrl}
                onChange={(event) => setToken("bannerUrl", event.target.value)}
                placeholder="https://"
              />
              <input
                type="file"
                accept="image/*"
                className="mt-2 text-xs text-white/45"
                onChange={(event) => readImage("bannerUrl", event.target.files?.[0])}
              />
            </Field>
            <Field label="Website" error={errors.website}>
              <Input value={draft.token.website} onChange={(event) => setToken("website", event.target.value)} placeholder="https://" />
            </Field>
            <Field label="X / Twitter" error={errors.twitter}>
              <Input value={draft.token.twitter} onChange={(event) => setToken("twitter", event.target.value)} placeholder="@handle" />
            </Field>
            <Field label="Telegram" error={errors.telegram}>
              <Input value={draft.token.telegram} onChange={(event) => setToken("telegram", event.target.value)} placeholder="https://t.me/" />
            </Field>
            <Field label="Discord" error={errors.discord}>
              <Input value={draft.token.discord} onChange={(event) => setToken("discord", event.target.value)} placeholder="https://discord.gg/" />
            </Field>
          </div>

          <div className="ox-console rounded-[1.35rem] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Additional links</p>
              <button
                type="button"
                onClick={() => setToken("extraLinks", [...draft.token.extraLinks, { label: "", url: "" }])}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
              >
                Add link
              </button>
            </div>
            {errors.extraLinks ? <p className="mt-2 text-xs text-heat">{errors.extraLinks}</p> : null}
            <div className="mt-3 space-y-2">
              {draft.token.extraLinks.map((link, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                  <Input
                    value={link.label}
                    placeholder="Label"
                    onChange={(event) =>
                      setToken(
                        "extraLinks",
                        draft.token.extraLinks.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, label: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Input
                    value={link.url}
                    placeholder="https://"
                    onChange={(event) =>
                      setToken(
                        "extraLinks",
                        draft.token.extraLinks.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, url: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setToken(
                        "extraLinks",
                        draft.token.extraLinks.filter((_, rowIndex) => rowIndex !== index),
                      )
                    }
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <SupplyBreakdown
            supply={draft.token.supply}
            plan={draft.supply}
            onChange={(allocations) => patch("supply", { allocations })}
          />
        </div>
        <TokenPreview token={draft.token} />
      </div>
    </section>
  );
}
