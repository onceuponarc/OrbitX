"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CoverField, type CoverPick } from "@/components/launch/cover-field";
import {
  DescriptionLinksFields,
  EMPTY_DESCRIPTION_LINKS,
  type DescriptionLinksValue,
} from "@/components/launch/description-links-fields";
import { readApiJson } from "@/lib/http/read-json";

export function ArcLaunchStudio({ handle, pairCard = false }: { handle: string | null; pairCard?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [ticker, setTicker] = useState("");
  const [links, setLinks] = useState<DescriptionLinksValue>({
    ...EMPTY_DESCRIPTION_LINKS,
    twitter: handle ? `@${handle}` : "",
  });
  const [cover, setCover] = useState<CoverPick | null>(null);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function launch(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setStatus("Preparing your Argus launch…");
    try {
      const res = await fetch("/api/arc/launch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          ticker,
          blurb: links.description,
          website: links.website,
          twitter: links.twitter,
          telegram: links.telegram,
          coverUrl: cover?.url,
          imageUri: cover?.imageUri,
          rightsAttested: rights,
        }),
      });
      const body = await readApiJson<{ error?: string; slug?: string; hash?: string; token?: string }>(res);
      if (!res.ok || !body.hash) throw new Error(body.error ?? "Arc launch failed.");
      setStatus("Live on Argus. Your token, v4 pool id, hook, and locker are now recorded on Arc mainnet.");
      if (pairCard && body.slug) router.push(`/cards`); else if (body.slug) router.push(`/story/${body.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arc launch failed.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={(event) => void launch(event)} className="space-y-5">
      <section className="glass space-y-4 rounded-2xl border border-arc/20 p-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">Arc mainnet · Argus</p>
          <h2 className="mt-1 text-2xl font-semibold">Launch on Argus</h2>
          <p className="mt-2 text-sm text-parchment/65">A fixed-supply token opens immediately on Arc 5042 through Argus v4, with a per-token hook, pool id, and locked liquidity position.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Name</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Ticker</Label><Input value={ticker} maxLength={10} onChange={(e) => setTicker(e.target.value.toUpperCase())} required /></div></div>
        <DescriptionLinksFields value={links} onChange={setLinks} />
        <CoverField value={cover} onChange={setCover} />
      </section>
      <section className="glass space-y-3 rounded-2xl border border-arc/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">Argus launch settings</p>
        <p className="text-sm text-parchment/65">Argus creates a fixed-supply token, initializes a Uniswap v4 pool through its Portal, and records the locker, hook, and pool id. Your Arc wallet signs the transaction.</p>
        <p className="text-xs text-parchment/45">This OrbitX flow uses Argus Portal #7 with Arc USDC, 3% buy/sell tax, and a fixed 1 billion token supply.</p>
      </section>
      <section className="glass space-y-4 rounded-2xl border border-arc/20 p-4"><p className="text-sm text-parchment/70">Your Arc wallet signs the Argus Portal transaction. The launch contract creates the token and its v4 liquidity position atomically.</p>
        <label className="flex items-start gap-3 text-sm"><Switch checked={rights} onCheckedChange={setRights} /><span>I have the rights to use this token name and artwork.</span></label>
        <Button type="submit" disabled={!rights || busy || !title || !ticker}>{busy ? status ?? "Launching…" : "Launch on Arc mainnet"}</Button>
        {error ? <Alert variant="destructive"><AlertTitle>Launch blocked</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        {status && !error ? <Alert><AlertTitle>Argus launch</AlertTitle><AlertDescription>{status}</AlertDescription></Alert> : null}
      </section>
    </form>
  );
}
