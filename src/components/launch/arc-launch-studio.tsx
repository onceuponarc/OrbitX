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
import { cn } from "@/lib/utils";

type FeeMode = "creator" | "holders" | "burn" | "floor";
const USDC = "0x3600000000000000000000000000000000000000";
const FEE_MODES: { id: FeeMode; title: string; body: string }[] = [
  { id: "creator", title: "Creator", body: "Creator keeps the creator share in the fee escrow." },
  { id: "holders", title: "Fees to holders", body: "Creator share is distributed pro rata to token holders." },
  { id: "burn", title: "Buyback & burn", body: "Creator share buys the token in its own markets and burns it." },
  { id: "floor", title: "Floor mode", body: "Creator share becomes a locked buy wall that only rises." },
];

export function ArcLaunchStudio({ handle, pairCard = false }: { handle: string | null; pairCard?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [ticker, setTicker] = useState("");
  const [blurb, setBlurb] = useState("");
  const [cover, setCover] = useState<CoverPick | null>(null);
  const [quotes, setQuotes] = useState<string[]>([USDC]);
  const [feeMode, setFeeMode] = useState<FeeMode>("creator");
  const [creatorTaxBps, setCreatorTaxBps] = useState(100);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function updateQuote(index: number, value: string) {
    setQuotes((current) => current.map((item, i) => (i === index ? value.trim() : item)));
  }
  function addQuote() {
    if (quotes.length < 5) setQuotes((current) => [...current, ""]);
  }
  function removeQuote(index: number) {
    if (quotes.length > 1) setQuotes((current) => current.filter((_, i) => i !== index));
  }

  async function launch(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setStatus("Simulating the Arc multi-market launch…");
    try {
      const selectedQuotes = quotes.map((quote) => quote.trim()).filter(Boolean);
      const res = await fetch("/api/arc/launch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ticker, blurb, coverUrl: cover?.url, quoteAssets: selectedQuotes, feeMode, creatorTaxBps, rightsAttested: rights }),
      });
      const body = await readApiJson<{ error?: string; slug?: string; hash?: string; token?: string }>(res);
      if (!res.ok || !body.hash) throw new Error(body.error ?? "Arc launch failed.");
      setStatus(`Live on Arc. ${selectedQuotes.length} market${selectedQuotes.length === 1 ? "" : "s"} opened atomically.`);
      if (pairCard && body.slug) router.push(`/cards`); else if (body.slug) router.push(`/story/${body.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arc launch failed.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={(event) => void launch(event)} className="space-y-5">
      <section className="glass space-y-4 rounded-2xl border border-arc/20 p-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">Arc mainnet · Par</p>
          <h2 className="mt-1 text-2xl font-semibold">Instant multi-market launch</h2>
          <p className="mt-2 text-sm text-parchment/65">A plain Uniswap v4 pool opens immediately on Arc 5042. No bonding curve phase or migration. Choose one to five quote assets; every market is seeded and locked in the same transaction.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Name</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Ticker</Label><Input value={ticker} maxLength={10} onChange={(e) => setTicker(e.target.value.toUpperCase())} required /></div></div>
        <div className="space-y-2"><Label>Pitch</Label><Textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={3} /></div>
        <CoverField value={cover} onChange={setCover} />
      </section>
      <section className="glass space-y-4 rounded-2xl border border-arc/20 p-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">Markets</p><p className="text-sm text-parchment/65">USDC is the Arc reference asset. Other assets are accepted when Par’s on-chain pricer can value them through qualifying Uniswap liquidity.</p></div>
        {quotes.map((quote, index) => <div className="flex gap-2" key={`${index}-${quote}`}><Input aria-label={`Quote asset ${index + 1}`} value={quote} onChange={(e) => updateQuote(index, e.target.value)} placeholder={USDC} required />{quotes.length > 1 ? <Button type="button" variant="outline" onClick={() => removeQuote(index)}>Remove</Button> : null}</div>)}
        <div className="flex items-center justify-between"><span className="text-xs text-parchment/55">{quotes.length}/5 markets · no duplicates · no native address on Arc</span><Button type="button" variant="outline" onClick={addQuote} disabled={quotes.length >= 5}>Add market</Button></div>
      </section>
      <section className="glass space-y-4 rounded-2xl border border-arc/20 p-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-arc">Fee policy</p><p className="text-sm text-parchment/65">The choice is frozen into the launch’s fee recipient. It cannot be silently changed after creation.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">{FEE_MODES.map((mode) => <button type="button" key={mode.id} onClick={() => setFeeMode(mode.id)} className={cn("rounded-xl border p-3 text-left", feeMode === mode.id ? "border-arc bg-arc/15" : "border-white/10 bg-white/5")}><p className="font-semibold">{mode.title}</p><p className="mt-1 text-xs text-parchment/60">{mode.body}</p></button>)}</div>
        <div className="space-y-2"><Label>Creator tax: {(creatorTaxBps / 100).toFixed(2)}% (0–10%)</Label><input className="w-full accent-[#00e5c3]" type="range" min={0} max={1000} value={creatorTaxBps} onChange={(e) => setCreatorTaxBps(Number(e.target.value))} /></div>
      </section>
      <section className="glass space-y-4 rounded-2xl border border-arc/20 p-4"><p className="text-sm text-parchment/70">Your Arc wallet signs the launch and pays the 0.0005 USDC protocol launch fee plus gas. All selected pools open together; liquidity is locked by Par’s multi-market locker.</p>
        <label className="flex items-start gap-3 text-sm"><Switch checked={rights} onCheckedChange={setRights} /><span>I have the rights to use this token name and artwork.</span></label>
        <Button type="submit" disabled={!rights || busy || !title || !ticker}>{busy ? status ?? "Launching…" : "Launch on Arc mainnet"}</Button>
        {error ? <Alert variant="destructive"><AlertTitle>Launch blocked</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        {status && !error ? <Alert><AlertTitle>Par launch</AlertTitle><AlertDescription>{status}</AlertDescription></Alert> : null}
      </section>
    </form>
  );
}
