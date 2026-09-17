"use client";

import { useMemo, useState } from "react";
import { JUPITER, SOLANA } from "@onceupon/config/solana";
import { QUOTE_ASSETS } from "@onceupon/config/quotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { XMark } from "@/components/x-mark";
import { readApiJson } from "@/lib/http/read-json";
import type { JupiterQuote } from "@/lib/jupiter";

const SWAP_TOKENS = [
  { symbol: "SOL", mint: SOLANA.wsolMint, decimals: 9 },
  { symbol: "USDC", mint: SOLANA.usdcMint, decimals: 6 },
  ...QUOTE_ASSETS.filter((item) =>
    item.mint && ["cbbtc", "weth", "usdt", "pyusd", "bonk", "wif", "jup", "pengu", "aaplx", "tslax", "nvdax"].includes(item.id),
  ).map((item) => ({ symbol: item.symbol, mint: item.mint as string, decimals: item.decimals })),
];

function formatAmount(raw: string, decimals: number) {
  const value = Number(raw) / 10 ** decimals;
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals > 6 ? 4 : 4 });
}

export function JupiterSwapPanel({
  title = "Jupiter route",
  signedIn = false,
  extraMint,
  extraSymbol,
  extraDecimals = 6,
  defaultOutput,
}: {
  title?: string;
  signedIn?: boolean;
  extraMint?: string;
  extraSymbol?: string;
  extraDecimals?: number;
  defaultOutput?: string;
}) {
  const tokens = useMemo(() => {
    const list = [...SWAP_TOKENS];
    if (extraMint && extraSymbol && !list.some((item) => item.mint === extraMint)) {
      list.push({ symbol: extraSymbol, mint: extraMint, decimals: extraDecimals });
    }
    return list;
  }, [extraMint, extraSymbol, extraDecimals]);

  const [inputSymbol, setInputSymbol] = useState("SOL");
  const [outputSymbol, setOutputSymbol] = useState(defaultOutput ?? extraSymbol ?? "USDC");
  const [amount, setAmount] = useState("0.1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [rawQuote, setRawQuote] = useState<Record<string, unknown> | null>(null);

  const input = tokens.find((item) => item.symbol === inputSymbol) ?? tokens[0];
  const output = tokens.find((item) => item.symbol === outputSymbol) ?? tokens[1];
  const hops = quote?.hops ?? [];

  const rawAmount = useMemo(() => {
    const ui = Number(amount);
    if (!Number.isFinite(ui) || ui <= 0) return "";
    return BigInt(Math.round(ui * 10 ** input.decimals)).toString();
  }, [amount, input.decimals]);

  async function loadQuote() {
    if (!rawAmount) {
      setError("Enter an amount.");
      return;
    }
    if (input.mint === output.mint) {
      setError("Pick two different tokens.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/jupiter/quote?inputMint=${input.mint}&outputMint=${output.mint}&amount=${rawAmount}&slippageBps=50`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No Jupiter route.");
      setQuote(body.quote as JupiterQuote);
      setRawQuote(body.raw as Record<string, unknown>);
    } catch (err) {
      setQuote(null);
      setRawQuote(null);
      setError(err instanceof Error ? err.message : "Jupiter quote failed.");
    } finally {
      setBusy(false);
    }
  }

  async function swap() {
    if (!signedIn) {
      setError("Sign in with X first. Swaps use your in-app Solana desk.");
      return;
    }
    if (!rawQuote) {
      setError("Get a route first.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      setStatus("Signing with your in-app Solana desk…");
      const res = await fetch("/api/jupiter/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteResponse: rawQuote }),
      });
      const body = await readApiJson<{ error?: string; signature?: string }>(res);
      if (!res.ok || !body.signature) throw new Error(body.error ?? "Jupiter could not land the swap.");
      setStatus(`Landed ${body.signature}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass space-y-4 rounded-2xl border border-arc/20 p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arc">{title}</p>
        <h2 className="font-heading text-xl font-bold">Route through Jupiter</h2>
        <p className="mt-1 text-sm text-parchment/65">
          Quotes come from Jupiter. Your in-app Solana desk signs the swap. Pair SOL, cbBTC, stocks, memes, or any mint.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>From</Label>
          <select
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value)}
            className="h-8 w-full rounded-lg border border-arc/25 bg-ink/60 px-2 text-sm"
          >
            {tokens.map((token) => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <select
            value={outputSymbol}
            onChange={(e) => setOutputSymbol(e.target.value)}
            className="h-8 w-full rounded-lg border border-arc/25 bg-ink/60 px-2 text-sm"
          >
            {tokens.map((token) => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Amount</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void loadQuote()} disabled={busy}>
          {busy && !quote ? "Routing…" : "Get Jupiter route"}
        </Button>
        {signedIn ? (
          <Button type="button" variant="secondary" onClick={() => void swap()} disabled={busy || !quote}>
            Swap from desk
          </Button>
        ) : (
          <Button type="button" variant="ghost" asChild>
            <a href="/auth/login">
              <XMark className="size-3.5" />
              Sign in with X
            </a>
          </Button>
        )}
        <Button type="button" variant="ghost" asChild>
          <a href={JUPITER.app} target="_blank" rel="noreferrer">
            Open jup.ag
          </a>
        </Button>
      </div>

      {quote ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <p className="text-parchment">
            {formatAmount(quote.inAmount, input.decimals)} {input.symbol} →{" "}
            {formatAmount(quote.outAmount, output.decimals)} {output.symbol}
          </p>
          <p className="mt-1 text-xs text-parchment/55">
            Impact {Number(quote.priceImpactPct).toFixed(3)}% · slippage {(quote.slippageBps / 100).toFixed(2)}%
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hops.length ? (
              hops.map((hop, index) => (
                <Badge key={`${hop.label}-${index}`} variant="outline" className="text-[11px]">
                  {hop.label}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">Direct</Badge>
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Route blocked</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {status ? (
        <Alert>
          <AlertTitle>Swap</AlertTitle>
          <AlertDescription className="break-all">{status}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
