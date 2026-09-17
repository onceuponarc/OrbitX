"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SOLANA } from "@onceupon/config/solana";
import {
  canonicalPoolsForQuote,
  catalogFor,
  createLpLinks,
  type DexId,
} from "@onceupon/config/pools";
import { findQuote, findQuoteByMint } from "@onceupon/config/quotes";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PoolPicker, type LinkedPoolPick } from "@/components/launch/pool-picker";
import { readApiJson } from "@/lib/http/read-json";

function quoteOptions(storyMint: string | null, pairLabel: string) {
  const listed = findQuoteByMint(storyMint) ?? findQuote("sol");
  const story = {
    mint: storyMint || SOLANA.wsolMint,
    symbol: listed?.symbol ?? pairLabel ?? "SOL",
  };
  const extras = [
    { mint: SOLANA.wsolMint, symbol: "SOL" },
    { mint: SOLANA.usdcMint, symbol: "USDC" },
  ];
  const out = [story];
  for (const extra of extras) {
    if (out.some((item) => item.mint === extra.mint)) continue;
    out.push(extra);
  }
  return out;
}

export function LinkLp({
  slug,
  ticker,
  tokenMint,
  quoteMint,
  pairLabel,
  boundAddresses,
  venue = "spl",
  curveTokenRaw = "0",
  mintDecimals = 6,
  storyStatus = "live",
  curveQuoteRaw = "0",
  graduationQuoteRaw = "0",
}: {
  slug: string;
  ticker: string;
  tokenMint: string | null;
  quoteMint: string | null;
  pairLabel: string;
  boundAddresses: string[];
  venue?: string;
  curveTokenRaw?: string | number | null;
  mintDecimals?: number;
  storyStatus?: string;
  curveQuoteRaw?: string | number | null;
  graduationQuoteRaw?: string | number | null;
}) {
  const router = useRouter();
  const listed = findQuoteByMint(quoteMint) ?? findQuote("sol");
  const quoteId = listed?.id ?? "sol";
  const quoteSymbol = listed?.symbol ?? pairLabel ?? "SOL";
  const canonical = canonicalPoolsForQuote(quoteId);
  const catalog = catalogFor("solana");
  const options = useMemo(() => quoteOptions(quoteMint, pairLabel), [quoteMint, pairLabel]);
  const [pairQuote] = useState(options[0]?.mint ?? SOLANA.wsolMint);
  const [pool, setPool] = useState<LinkedPoolPick | null>(
    canonical[0]
      ? {
          address: canonical[0].address,
          dex: canonical[0].dex,
          label: canonical[0].label,
          url: canonical[0].url,
          chain: "solana",
          depthUsd: canonical[0].liquidityUsd,
          quoteAddress: quoteMint,
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const lpLinks = useMemo(
    () => (tokenMint ? createLpLinks(tokenMint, pairQuote || quoteMint) : []),
    [tokenMint, pairQuote, quoteMint],
  );

  async function bind(pick: LinkedPoolPick) {
    setBusy(true);
    setError(null);
    setOk(null);
    setStatus(null);
    try {
      const res = await fetch("/api/bindings/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storySlug: slug,
          chainCaip2: catalog.caip2,
          poolAddress: pick.address,
          mechanism: pick.dex,
          proofUrl: pick.url || undefined,
          depthUsd: pick.depthUsd,
          quoteAddress: pick.quoteAddress ?? quoteMint,
          label: pick.label,
        }),
      });
      const body = await readApiJson<{ error?: string; label?: string }>(res);
      if (!res.ok) {
        setError(body.error ?? "Could not bind that pool.");
        return;
      }
      setOk(`Bound ${body.label ?? pick.label}. That tags quote depth. It does not deposit your mint.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not bind that pool.");
    } finally {
      setBusy(false);
    }
  }

  async function pairOnPumpSwap(fromVault: boolean) {
    if (!tokenMint) {
      setError("Mint is not on-chain yet. Finish print first.");
      return;
    }
    if (!fromVault) {
      setError("Author-seeded LP at print is closed. The vault opens the book at graduation.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      setStatus("Opening PumpSwap from your in-app Solana desk…");
      const res = await fetch(`/api/stories/${slug}/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteMint,
          quoteUi: 0,
          baseBps: 10_000,
          fromVault: true,
        }),
      });
      const body = await readApiJson<{
        error?: string;
        already?: boolean;
        explorer?: string;
        proofUrl?: string;
        label?: string;
      }>(res);
      if (!res.ok) {
        setError(body.error ?? "Could not open the PumpSwap pool.");
        return;
      }
      setOk(
        `${body.label ?? "PumpSwap pool"} is on-chain. DexScreener and Jupiter index it from the pool account.`,
      );
      setStatus(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open PumpSwap LP.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  const already = new Set(boundAddresses.map((item) => item.toLowerCase()));
  const quoteDepthBound = canonical.some((item) => already.has(item.address.toLowerCase()));
  const nft = venue === "nft";
  const realQuote = Number(curveQuoteRaw ?? 0);
  const graduateTarget = Number(graduationQuoteRaw ?? 0);
  const canGraduate = storyStatus === "graduated" || (graduateTarget > 0 && realQuote >= graduateTarget);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-parchment/70">
        <p className="font-medium text-parchment">
          Quote is {quoteSymbol}
          {listed?.group === "stock" || listed?.group === "etf" ? " · quote pair, not studio equity" : ""}
        </p>
        <p className="mt-1">
          This Story trades on a Chapter Curve. Buyers pay {quoteSymbol} into the vault. The Author does not seed an
          AMM at print. DexScreener and Jupiter index LP when the Chapter graduates and the vault opens the book.
          Binding {quoteSymbol} depth below is hop-1 routing — it does not put ${ticker} in that pool.
        </p>
        {tokenMint ? (
          <p className="mt-2 break-all font-mono text-[11px] text-parchment/50">Your mint · {tokenMint}</p>
        ) : (
          <p className="mt-2 text-burgundy">Mint is not on-chain yet. Finish sign-and-pay first.</p>
        )}
        {quoteMint ? (
          <p className="mt-1 break-all font-mono text-[11px] text-parchment/50">
            {quoteSymbol} mint · {quoteMint}
          </p>
        ) : (
          <p className="mt-1 break-all font-mono text-[11px] text-parchment/50">SOL mint · {SOLANA.wsolMint}</p>
        )}
      </div>

      {nft ? (
        <p className="text-sm text-parchment/70">NFTs do not open a PumpSwap pool.</p>
      ) : canGraduate ? (
        <div className="space-y-3 rounded-xl border border-arc/25 bg-arc/5 p-3">
          <p className="text-sm font-medium text-parchment">1 · Graduate the book from the vault</p>
          <p className="text-xs text-parchment/55">
            Gas is paid by your in-app Solana desk. Remaining ${ticker} and {quoteSymbol} in the vault seed PumpSwap.
            You do not deposit extra quote.
          </p>
          <Button type="button" disabled={busy || !tokenMint} onClick={() => void pairOnPumpSwap(true)}>
            {busy ? status ?? "Signing…" : `Open $${ticker}/${quoteSymbol} from the vault`}
          </Button>
          {status && busy ? <p className="text-xs text-parchment/55">{status}</p> : null}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-sm font-medium text-parchment">1 · AMM opens at graduation</p>
          <p className="text-xs text-parchment/55">
            Buyers feed the book until {graduateTarget > 0 ? graduateTarget.toLocaleString("en-US") : "the"}{" "}
            {quoteSymbol} target. You do not deposit {quoteSymbol} as inventory at print. Vault still holds{" "}
            {(Number(curveTokenRaw ?? 0) / 10 ** mintDecimals).toLocaleString("en-US", { maximumFractionDigits: 2 })} $
            {ticker}.
          </p>
        </div>
      )}

      {canonical.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-parchment">2 · Optional · tag quote depth</p>
          <p className="text-xs text-parchment/55">
            {canonical[0].label} is the live {quoteSymbol} market. Binding it labels this Story. It does not put $
            {ticker} in that pool.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{canonical[0].dex}</Badge>
            <span className="font-mono text-[11px] text-parchment/50">
              {canonical[0].address.slice(0, 6)}…{canonical[0].address.slice(-4)}
            </span>
            {quoteDepthBound ? (
              <Badge>Already bound</Badge>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !tokenMint}
                onClick={() =>
                  void bind({
                    address: canonical[0].address,
                    dex: canonical[0].dex as DexId,
                    label: canonical[0].label,
                    url: canonical[0].url,
                    chain: "solana",
                    depthUsd: canonical[0].liquidityUsd,
                    quoteAddress: quoteMint,
                  })
                }
              >
                {busy ? "Binding…" : `Tag ${canonical[0].label}`}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-parchment">3 · Other AMMs</p>
        <p className="text-xs text-parchment/55">
          Raydium, Meteora, or Orca if you want a second venue. You still pay liquidity there. Paste that pool below
          after it exists.
        </p>
        <div className="flex flex-wrap gap-2">
          {tokenMint ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void copy(tokenMint)}>
              Copy your mint
            </Button>
          ) : null}
          {quoteMint ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void copy(quoteMint)}>
              Copy {quoteSymbol} mint
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void copy(SOLANA.usdcMint)}>
            Copy USDC mint
          </Button>
          {lpLinks.map((link) => (
            <Button key={link.id} asChild size="sm" variant="outline">
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.name}
              </a>
            </Button>
          ))}
        </div>
      </div>

      <PoolPicker
        chain="solana"
        quoteId={quoteId}
        mint={quoteMint || ""}
        selected={pool}
        onSelect={setPool}
        heading="4 · Paste a pool that already exists"
      />

      <Button
        type="button"
        variant="outline"
        disabled={busy || !pool?.address || !tokenMint}
        onClick={() => pool && void bind(pool)}
      >
        {busy ? "Binding…" : pool ? `Tag ${pool.label}` : "Pick a pool"}
      </Button>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Pair blocked</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {ok ? (
        <Alert>
          <AlertTitle>Liquidity</AlertTitle>
          <AlertDescription>{ok}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
