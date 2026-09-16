"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readApiJson } from "@/lib/http/read-json";
import { cn } from "@/lib/utils";

type Quote = {
  side: "buy" | "sell";
  /** Fee is always denominated in the quote asset, never the token. */
  feeMint: string;
  feeBps: number;
  grossInUi: number;
  /** Exactly what the backend will collect — same math, same source. */
  orbitxFeeUi: number;
  netSwapInUi?: number;
  grossOutUi?: number;
  outAmountUi: number;
  minReceivedUi: number;
  priceImpactPct: number;
  route: string;
};

export function TradePanel({
  tokenMint,
  tokenSymbol,
  signedIn,
}: {
  tokenMint: string;
  tokenSymbol: string;
  signedIn: boolean;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quoteAsset, setQuoteAsset] = useState<"sol" | "usdc">("sol");
  const [amount, setAmount] = useState("0.1");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    signature: string;
    explorer: string;
    outAmountUi: number;
    orbitxFeeUi: number;
  } | null>(null);

  useEffect(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      return;
    }
    let live = true;
    setQuoting(true);
    const params = new URLSearchParams({
      token: tokenMint,
      quote: quoteAsset,
      side,
      amount: amount,
    });
    const id = window.setTimeout(() => {
      fetch(`/api/trade/quote?${params}`, { cache: "no-store" })
        .then((res) => readApiJson<Quote & { error?: string }>(res))
        .then((body) => {
          if (!live) return;
          if (body.error) {
            setError(body.error);
            setQuote(null);
          } else {
            setError(null);
            setQuote(body);
          }
        })
        .catch(() => live && setQuote(null))
        .finally(() => live && setQuoting(false));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [tokenMint, quoteAsset, side, amount]);

  async function trade() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/trade/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenMint, quoteAsset, side, amount: Number(amount) }),
      });
      const body = await readApiJson<{
        error?: string;
        signature?: string;
        explorer?: string;
        outAmountUi?: number;
        orbitxFeeUi?: number;
      }>(res);
      if (!res.ok || !body.signature) throw new Error(body.error ?? "Trade failed.");
      setResult({
        signature: body.signature,
        explorer: body.explorer ?? "",
        outAmountUi: body.outAmountUi ?? 0,
        orbitxFeeUi: body.orbitxFeeUi ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed.");
    } finally {
      setBusy(false);
    }
  }

  const quoteLabel = quoteAsset.toUpperCase();

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 p-5">
      <div className="grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-black/30 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "rounded-full py-2 text-sm font-medium capitalize transition-colors",
              side === s
                ? s === "buy"
                  ? "bg-buy/20 text-buy"
                  : "bg-sell/20 text-sell"
                : "text-white/50 hover:text-white/80",
            )}
          >
            {s === "buy" ? `Buy $${tokenSymbol}` : `Sell $${tokenSymbol}`}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>{side === "buy" ? "Pay with" : "Receive as"}</span>
          <div className="flex gap-1">
            {(["sol", "usdc"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setQuoteAsset(a)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] uppercase",
                  quoteAsset === a ? "border-arc/50 text-arc" : "border-white/10 text-white/50",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <Input
          className="mt-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Amount in ${side === "buy" ? quoteLabel : tokenSymbol}`}
        />
      </div>

      <div className="space-y-1.5 rounded-2xl border border-white/10 p-3 text-sm">
        {quoting ? (
          <p className="text-white/40">Fetching quote…</p>
        ) : quote ? (
          <>
            <div className="flex justify-between">
              <span className="text-white/40">You receive</span>
              <span className="tabular-nums">
                {quote.outAmountUi.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                {side === "buy" ? tokenSymbol : quoteLabel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Min received</span>
              <span className="tabular-nums text-white/70">
                {quote.minReceivedUi.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">
                OrbitX fee ({(quote.feeBps / 100).toFixed(2)}%)
              </span>
              <span className="tabular-nums text-white/70">
                {quote.orbitxFeeUi.toLocaleString(undefined, { maximumFractionDigits: 9 })}{" "}
                {quoteLabel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Price impact</span>
              <span className={cn("tabular-nums", quote.priceImpactPct > 3 ? "text-sell" : "text-white/70")}>
                {quote.priceImpactPct.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Route</span>
              <span className="truncate text-white/50">{quote.route}</span>
            </div>
          </>
        ) : (
          <p className="text-white/40">Enter an amount to get a quote.</p>
        )}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {result ? (
        <p className="text-sm text-emerald-400">
          Done — got {result.outAmountUi.toLocaleString(undefined, { maximumFractionDigits: 6 })}.{" "}
          <a href={result.explorer} target="_blank" rel="noreferrer" className="underline">
            View tx
          </a>
        </p>
      ) : null}

      {signedIn ? (
        <Button
          type="button"
          onClick={() => void trade()}
          disabled={busy || !quote}
          className={cn("w-full", side === "sell" && "bg-sell hover:bg-sell/90")}
        >
          {busy ? "Trading…" : side === "buy" ? `Buy $${tokenSymbol}` : `Sell $${tokenSymbol}`}
        </Button>
      ) : (
        <p className="text-center text-sm text-white/45">Sign in with X to trade with your desk wallet.</p>
      )}
      <p className="text-center text-[11px] text-white/30">Routed through Jupiter · your in-app Solana wallet signs</p>
    </div>
  );
}
