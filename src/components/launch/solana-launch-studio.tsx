"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CoverField, type CoverPick } from "@/components/launch/cover-field";
import {
  DescriptionLinksFields,
  EMPTY_DESCRIPTION_LINKS,
  type DescriptionLinksValue,
} from "@/components/launch/description-links-fields";
import {
  AdvancedLaunchFields,
  DEFAULT_ADVANCED_LAUNCH,
  type AdvancedLaunchValue,
} from "@/components/launch/advanced-launch-fields";
import { DevFundBanner } from "@/components/wallet/dev-fund-banner";
import { readApiJson } from "@/lib/http/read-json";
import { VANITY_SUFFIX } from "@/lib/solana/vanity";
import { mineVanitySecretBrowser } from "@/lib/solana/vanity-browser";
import { LaunchLiveCard, type LiveLaunch } from "@/components/launch/launch-live-card";

export function SolanaLaunchStudio({ handle }: { handle: string | null }) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [links, setLinks] = useState<DescriptionLinksValue>({
    ...EMPTY_DESCRIPTION_LINKS,
    twitter: handle ? `@${handle}` : "",
  });
  const [advanced, setAdvanced] = useState<AdvancedLaunchValue>(DEFAULT_ADVANCED_LAUNCH);
  const [cover, setCover] = useState<CoverPick | null>(null);
  const [vanity, setVanity] = useState(true);
  const [mintSecret, setMintSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveLaunch | null>(null);

  useEffect(() => {
    if (!vanity) return;
    const ac = new AbortController();
    void mineVanitySecretBrowser(VANITY_SUFFIX, ac.signal).then((secret) => {
      if (!ac.signal.aborted && secret) setMintSecret(secret);
    });
    return () => ac.abort();
  }, [vanity]);

  async function launch(event: React.FormEvent) {
    event.preventDefault();
    if (!handle) {
      setError("Sign in with X first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        name,
        symbol,
        blurb: links.description,
        website: links.website,
        twitter: links.twitter,
        telegram: links.telegram,
        coverUrl: cover?.url,
        imageUri: cover?.imageUri,
        vanity,
        mintSecret: vanity ? mintSecret : null,
        poolPair: advanced.poolPair,
        customQuoteMint: advanced.customQuoteMint,
        mayhemMode: advanced.mayhemMode,
        rewardsTo: advanced.rewardsTo,
        creatorFeeBps: advanced.creatorFeeBps,
      };
      const attempts = vanity ? 4 : 1;
      let body: {
        error?: string;
        retryable?: boolean;
        mint?: string;
        slug?: string;
        signature?: string;
        creator?: string;
      } | null = null;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        const built = await fetch("/api/solana/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        body = await readApiJson<{
          error?: string;
          retryable?: boolean;
          mint?: string;
          slug?: string;
          signature?: string;
          creator?: string;
        }>(built);
        if (built.ok && body.mint) {
          setMintSecret(null);
          break;
        }
        if (!body.retryable || attempt === attempts) {
          throw new Error(body.error ?? "Fund your in-app Solana wallet with SOL, then retry.");
        }
      }
      if (!body?.mint) throw new Error(body?.error ?? "Fund your in-app Solana wallet with SOL, then retry.");
      setResult({
        venue: "pumpfun",
        name,
        symbol: symbol.toUpperCase(),
        blurb: links.description,
        image: cover?.url ?? cover?.imageUri ?? null,
        mint: body.mint,
        slug: body.slug,
        signature: body.signature,
        creator: body.creator,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return <LaunchLiveCard live={result} onAgain={() => setResult(null)} />;
  }

  return (
    <form onSubmit={(event) => void launch(event)} className="pad-fade space-y-5 rounded-3xl border border-white/10 p-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Solana · pump.fun</p>
        <h2 className="mt-1 text-2xl font-semibold">Print on Solana</h2>
        <p className="mt-2 text-sm text-white/55">
          Your in-app Solana wallet is the dev wallet. Fund it with SOL. It pays gas, signs the mint, and collects
          fees. No Phantom.
        </p>
        <div className="mt-4">
          <DevFundBanner chain="solana" />
        </div>
      </div>
      <p className="text-sm text-white/50">Bonding curve on pump.fun. Buy and sell from create. Volume feeds the LP.</p>
      <CoverField value={cover} onChange={setCover} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label>Ticker</Label>
          <Input className="mt-2" value={symbol} onChange={(e) => setSymbol(e.target.value)} required />
        </div>
      </div>
      <DescriptionLinksFields value={links} onChange={setLinks} />
      <AdvancedLaunchFields value={advanced} onChange={setAdvanced} />
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={vanity}
          onChange={(e) => {
            const on = e.target.checked;
            setVanity(on);
            setMintSecret(null);
          }}
        />
        <span>
          Mine a …{VANITY_SUFFIX} mint
          {vanity ? (
            <span className="ml-2 text-xs text-white/40">
              {mintSecret ? `…${VANITY_SUFFIX} ready` : "grinding in the background"}
            </span>
          ) : null}
        </span>
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? (vanity && !mintSecret ? `Mining a …${VANITY_SUFFIX} mint…` : "Signing with your desk…") : "Launch on pump.fun"}
      </Button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <ClaimFees />
    </form>
  );
}

function ClaimFees() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function claim() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/solana/claim", { method: "POST" });
    const body = await readApiJson<{ error?: string; signature?: string; explorer?: string }>(res);
    setBusy(false);
    if (!res.ok || !body.signature) {
      setMsg(body.error ?? "Claim failed. Fund the in-app Solana wallet.");
      return;
    }
    setMsg(body.explorer ?? body.signature);
  }
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="text-sm font-semibold">Claim pump.fun creator fees</p>
      <p className="mt-1 text-xs text-white/45">Pays out to your in-app Solana desk. No Phantom.</p>
      <Button type="button" className="mt-3" variant="outline" disabled={busy} onClick={() => void claim()}>
        {busy ? "Claiming…" : "Claim fees"}
      </Button>
      {msg ? <p className="mt-2 break-all text-xs text-white/50">{msg}</p> : null}
    </div>
  );
}
