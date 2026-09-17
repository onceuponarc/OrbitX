"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { readApiJson } from "@/lib/http/read-json";
import { defaultCurveBuyUi } from "@onceupon/config/quotes";
import { pingMarket } from "@/lib/live-market";

export function CurveTrade({
  slug,
  venue,
  engine,
  pairLabel,
  decimals,
  quoteDecimals = 9,
  isAuthor = false,
  vaultRaw = 0,
}: {
  slug: string;
  venue: string;
  engine: string;
  pairLabel: string;
  decimals: number;
  quoteDecimals?: number;
  isAuthor?: boolean;
  vaultRaw?: number;
}) {
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState(defaultCurveBuyUi(pairLabel));
  const [fundAmount, setFundAmount] = useState(pairLabel === "SOL" ? "0.25" : pairLabel.toUpperCase() === "USDC" ? "25" : "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (venue === "nft") {
    return (
      <p className="text-sm text-parchment/70">
        This is an NFT mint. There is no bonding curve. The token lives on Solana at the address above.
      </p>
    );
  }

  async function submit(action: "buy" | "sell" | "claim" | "fund") {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const value = action === "fund" ? Number(fundAmount) : Number(amount);
      const res = await fetch(`/api/stories/${slug}/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount: value }),
      });
      const body = await readApiJson<{ error?: string; explorer?: string }>(res);
      if (!res.ok) {
        setError(body.error ?? "Trade failed.");
        return;
      }
      setResult(body.explorer ?? null);
      pingMarket();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-parchment/70">
        Quote is {pairLabel}. Pay {pairLabel} from your in-app Solana desk — not SOL, unless that is the quote.
        Jupiter has no pool for this mint until the Chapter graduates and the vault opens the book.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant={side === "buy" ? "default" : "outline"} onClick={() => setSide("buy")}>
          Buy
        </Button>
        <Button type="button" variant={side === "sell" ? "default" : "outline"} onClick={() => setSide("sell")}>
          Sell
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="amt">{side === "buy" ? `${pairLabel} in` : `Tokens in (decimals ${decimals})`}</Label>
        <Input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void submit(side)}>
          {busy ? "Sending…" : side === "buy" ? "Buy on the Chapter" : "Sell on the Chapter"}
        </Button>
        {engine === "onceuponers" ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void submit("claim")}>
            Claim holder share
          </Button>
        ) : null}
      </div>
      {engine === "onceuponers" && isAuthor ? (
        <div className="space-y-2 rounded-xl border border-arc/20 bg-arc/5 p-3">
          <Label htmlFor="fund">Fund holder claims ({pairLabel})</Label>
          <p className="text-xs text-parchment/55">
            Deposit from your desk into the Story vault. Holders claim in proportion to current holdings. Pool now:{" "}
            {(Number(vaultRaw) / 10 ** quoteDecimals).toLocaleString("en-US", { maximumFractionDigits: 6 })} {pairLabel}
          </p>
          <Input id="fund" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
          <Button type="button" variant="outline" disabled={busy} onClick={() => void submit("fund")}>
            {busy ? "Sending…" : `Deposit ${pairLabel}`}
          </Button>
        </div>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Trade blocked</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {result ? (
        <p className="text-sm">
          <a className="text-arc hover:underline" href={result} target="_blank" rel="noreferrer">
            View on explorer
          </a>
        </p>
      ) : null}
    </div>
  );
}
