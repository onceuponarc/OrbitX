"use client";

import type { TokenConfig } from "@/lib/custom-launch/token";
import { formatSupply } from "@/lib/custom-launch/token";

export function TokenPreview({ token }: { token: TokenConfig }) {
  const symbol = token.symbol.trim().toUpperCase();
  const name = token.name.trim() || "Token name";

  return (
    <article className="ox-console overflow-hidden rounded-[1.4rem]">
      <div className="relative h-28 bg-black/40">
        {token.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token.bannerUrl} alt="" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(80%_120%_at_80%_0%,rgb(214_255_61/18%),transparent_55%)]" />
        )}
        <div className="absolute -bottom-8 left-4 size-16 overflow-hidden rounded-2xl border border-white/15 bg-ink">
          {token.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={token.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <p className="flex h-full items-center justify-center px-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
              Image
            </p>
          )}
        </div>
      </div>
      <div className="px-4 pb-4 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">Live preview</p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight">{name}</h3>
        <p className="text-sm text-gold">{symbol ? `$${symbol}` : "$SYMBOL"}</p>
        <p className="mt-2 min-h-12 text-sm leading-relaxed text-white/55">
          {token.description.trim() || "Description appears here as you type."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
          {token.website ? <span>Website</span> : null}
          {token.twitter ? <span>X</span> : null}
          {token.telegram ? <span>Telegram</span> : null}
          {token.discord ? <span>Discord</span> : null}
          {!token.website && !token.twitter && !token.telegram && !token.discord ? (
            <span>Website / X / Telegram links</span>
          ) : null}
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Supply</p>
        <p className="text-lg font-semibold tabular-nums">{formatSupply(token.supply)}</p>
      </div>
    </article>
  );
}
