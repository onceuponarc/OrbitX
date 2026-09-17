"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CoverField, type CoverPick } from "@/components/launch/cover-field";
import {
  DescriptionLinksFields,
  EMPTY_DESCRIPTION_LINKS,
  type DescriptionLinksValue,
} from "@/components/launch/description-links-fields";
import { DevFundBanner } from "@/components/wallet/dev-fund-banner";
import { readApiJson } from "@/lib/http/read-json";
import { LaunchLiveCard, type LiveLaunch } from "@/components/launch/launch-live-card";

export function RhLaunchStudio({ handle }: { handle: string | null }) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [links, setLinks] = useState<DescriptionLinksValue>({
    ...EMPTY_DESCRIPTION_LINKS,
    twitter: handle ? `@${handle}` : "",
  });
  const [cover, setCover] = useState<CoverPick | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveLaunch | null>(null);

  async function launch(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/rh/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          symbol,
          coverUrl: cover?.url,
          imageUri: cover?.imageUri,
          handle,
          description: links.description,
          website: links.website,
          twitter: links.twitter,
          telegram: links.telegram,
        }),
      });
      const body = await readApiJson<{
        error?: string;
        hash?: string;
        token?: string;
        slug?: string;
        explorer?: string;
      }>(res);
      if (!res.ok || !body.token || !body.hash) {
        throw new Error(body.error ?? "Fund your in-app Robinhood wallet with ETH, then launch.");
      }
      setResult({
        venue: "pons",
        name,
        symbol: symbol.toUpperCase(),
        blurb: links.description,
        image: cover?.url ?? null,
        mint: body.token,
        slug: body.slug,
        signature: body.hash,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Robinhood launch failed.");
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
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Robinhood Chain · 4663</p>
        <h2 className="mt-1 text-2xl font-semibold">Pons launch</h2>
        <p className="mt-2 text-sm text-white/55">
          Best path on Robinhood: Pons v2. Curve is live at create so anyone can buy and sell. Volume feeds the
          book and graduates into a locked Uniswap v4 LP. Your in-app RH wallet pays gas and takes creator fees.
        </p>
      </div>
      <DevFundBanner chain="rh" />
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
      <Button type="submit" disabled={busy}>
        {busy ? "Signing with your desk…" : "Launch on Robinhood Chain"}
      </Button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </form>
  );
}
