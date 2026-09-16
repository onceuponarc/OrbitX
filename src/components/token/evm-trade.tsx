"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { readApiJson } from "@/lib/http/read-json";

export function EvmTrade({ chain, token, curve, symbol, quoteLabel }: { chain: "arc" | "robinhood"; token: string; curve?: string | null; symbol: string; quoteLabel: string }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null); setHash(null);
    try {
      const res = await fetch(chain === "arc" ? "/api/arc/trade" : "/api/rh/trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(chain === "arc" ? { token, side, amount } : { token, curve, side, amount }) });
      const body = await readApiJson<{ error?: string; hash?: string }>(res);
      if (!res.ok || !body.hash) throw new Error(body.error ?? "Trade failed.");
      setHash(body.hash);
    } catch (e) { setError(e instanceof Error ? e.message : "Trade failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-3xl border border-white/10 p-5">
    <div className="flex gap-2"><Button type="button" variant={side === "buy" ? "default" : "outline"} onClick={() => setSide("buy")}>Buy</Button><Button type="button" variant={side === "sell" ? "default" : "outline"} onClick={() => setSide("sell")}>Sell</Button></div>
    <Input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" aria-label={`${side} amount`} />
    <p className="text-xs text-white/45">{side === "buy" ? `${quoteLabel} in` : `${symbol} tokens in`} · signed by the OrbitX wallet for this account</p>
    <Button type="button" onClick={() => void submit()} disabled={busy || (chain === "robinhood" && !curve)}>{busy ? "Submitting…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}</Button>
    {error ? <Alert variant="destructive"><AlertTitle>Trade failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    {hash ? <p className="break-all text-xs text-emerald-300">Confirmed: {hash}</p> : null}
  </div>;
}
