"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyCa } from "@/components/story/copy-ca";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";

export type LiveLaunch = {
  venue: "pumpfun" | "uniswap-v4" | "pons" | "arcpad";
  name: string;
  symbol: string;
  blurb?: string;
  image?: string | null;
  mint: string;
  signature?: string;
  creator?: string;
  slug?: string | null;
};

function linksFor(live: LiveLaunch) {
  if (live.venue === "pumpfun") {
    return [
      { href: `https://pump.fun/coin/${live.mint}`, label: "pump.fun" },
      { href: `https://solscan.io/token/${live.mint}`, label: "Solscan" },
      { href: `https://dexscreener.com/solana/${live.mint}`, label: "DexScreener" },
      { href: `https://birdeye.so/token/${live.mint}?chain=solana`, label: "Birdeye" },
      live.signature ? { href: `https://solscan.io/tx/${live.signature}`, label: "Launch tx" } : null,
    ].filter((item): item is { href: string; label: string } => Boolean(item));
  }
  if (live.venue === "arcpad") {
    return [
      { href: `https://www.arcexplorer.org/address/${live.mint}`, label: "Arc Explorer" },
      live.signature ? { href: `https://www.arcexplorer.org/tx/${live.signature}`, label: "Launch tx" } : null,
      { href: `https://arcpad.meme/token/${live.mint}`, label: "ArcPad" },
    ].filter((item): item is { href: string; label: string } => Boolean(item));
  }
  if (live.venue === "pons") {
    return [
      { href: `https://explorer.robinhood.com/address/${live.mint}`, label: "Explorer" },
      live.signature ? { href: `https://explorer.robinhood.com/tx/${live.signature}`, label: "Launch tx" } : null,
    ].filter((item): item is { href: string; label: string } => Boolean(item));
  }
  return [
    { href: `https://www.arcscan.org/address/${live.mint}`, label: "Arcscan" },
    live.signature ? { href: `https://www.arcscan.org/tx/${live.signature}`, label: "Launch tx" } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));
}

function venueLine(venue: LiveLaunch["venue"]) {
  if (venue === "pumpfun") return "Live on pump.fun";
  if (venue === "pons") return "Live on Robinhood · Pons";
  if (venue === "arcpad") return "Live on Arc · ArcPad";
  return "Live on Arc · Uniswap v4";
}

export function LaunchLiveCard({ live, onAgain }: { live: LiveLaunch; onAgain: () => void }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const rows = linksFor(live);

  async function copyPack() {
    const pack = [
      `${live.name} ($${live.symbol}) is live on OrbitX`,
      venueLine(live.venue),
      live.blurb || "",
      `CA: ${live.mint}`,
      live.slug ? `${PUBLIC_SITE_URL}/story/${live.slug}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(pack);
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1600);
  }

  return (
    <div className="live-pop overflow-hidden rounded-3xl border border-emerald-400/25 bg-emerald-400/5">
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        <div className="relative min-h-52 bg-black/40">
          {live.image ? (
            <img src={live.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-52 items-center justify-center font-mono text-xs uppercase tracking-[0.2em] text-white/35">
              ${live.symbol}
            </div>
          )}
        </div>
        <div className="space-y-4 p-5 md:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300">Congratulations</p>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              {live.name} <span className="text-white/45">${live.symbol}</span>
            </h2>
            <p className="mt-1 text-sm text-emerald-200/80">{venueLine(live.venue)}. Tradable now.</p>
          </div>
          {live.blurb ? <p className="text-sm leading-6 text-white/65">{live.blurb}</p> : null}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Contract address</p>
            <p className="mt-1 break-all font-mono text-sm text-white">{live.mint}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyCa mint={live.mint} />
              <Button type="button" size="sm" variant="outline" onClick={() => void copyPack()}>
                {copiedAll ? "Copied pack" : "Copy CA + links"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {rows.map((item) => (
              <a key={item.label} className="text-gold underline-offset-4 hover:underline" href={item.href} target="_blank" rel="noreferrer">
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {live.slug ? (
              <Button type="button" asChild>
                <a href={`/story/${live.slug}`}>View on OrbitX</a>
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onAgain}>
              Launch another
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
