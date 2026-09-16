"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CoverField, type CoverPick } from "@/components/launch/cover-field";
import { readApiJson } from "@/lib/http/read-json";

export function ArcLaunchStudio({ handle, pairCard = false }: { handle: string | null; pairCard?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [ticker, setTicker] = useState("");
  const [blurb, setBlurb] = useState("");
  const [cover, setCover] = useState<CoverPick | null>(null);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function launch(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setStatus("Preparing your ArcPad launch…");
    try {
      const res = await fetch("/api/arc/launch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ticker, blurb, coverUrl: cover?.url, rightsAttested: rights }),
      });
      const body = await readApiJson<{ error?: string; slug?: string; hash?: string; token?: string }>(res);
      if (!res.ok || !body.hash) throw new Error(body.error ?? "Arc launch failed.");
      setStatus("Live on ArcPad. Your token and its locked liquidity are now on Arc mainnet.");
      if (pairCard && body.slug) router.push(`/cards`); else if (body.slug) router.push(`/story/${body.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arc launch failed.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={(event) => void launch(event)} className="space-y-5">
      <section className="glass space-y-4 rounded-2xl border border-arc/20 p-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">Arc mainnet · ArcPad</p>
          <h2 className="mt-1 text-2xl font-semibold">Launch on ArcPad</h2>
          <p className="mt-2 text-sm text-parchment/65">A fixed-supply token opens immediately on Arc 5042 through ArcPad, with an Arc USDC pool and locked liquidity.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Name</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Ticker</Label><Input value={ticker} maxLength={10} onChange={(e) => setTicker(e.target.value.toUpperCase())} required /></div></div>
        <div className="space-y-2"><Label>Pitch</Label><Textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={3} /></div>
        <CoverField value={cover} onChange={setCover} />
      </section>
      <section className="glass space-y-3 rounded-2xl border border-arc/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">ArcPad launch settings</p>
        <p className="text-sm text-parchment/65">ArcPad creates a fixed-supply token, opens one native-USDC market, and locks the initial liquidity in the same transaction. Your wallet pays the Arc gas/dev-buy amount and signs the transaction.</p>
        <p className="text-xs text-parchment/45">No quote-asset or fee-policy selection is needed for this ArcPad launch.</p>
      </section>
      <section className="glass space-y-4 rounded-2xl border border-arc/20 p-4"><p className="text-sm text-parchment/70">Your Arc wallet signs the launch and pays Arc USDC for gas. ArcPad creates the token and locks the initial liquidity in the same transaction.</p>
        <label className="flex items-start gap-3 text-sm"><Switch checked={rights} onCheckedChange={setRights} /><span>I have the rights to use this token name and artwork.</span></label>
        <Button type="submit" disabled={!rights || busy || !title || !ticker}>{busy ? status ?? "Launching…" : "Launch on Arc mainnet"}</Button>
        {error ? <Alert variant="destructive"><AlertTitle>Launch blocked</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        {status && !error ? <Alert><AlertTitle>ArcPad launch</AlertTitle><AlertDescription>{status}</AlertDescription></Alert> : null}
      </section>
    </form>
  );
}
