"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readApiJson } from "@/lib/http/read-json";

type Desk = {
  wallets: { solana: string | null; eth: string | null; rh: string | null; arc?: string | null };
  explorers: { solana: string | null; eth: string | null; rh: string | null };
};

const CHAINS = [
  { id: "solana", label: "Solana", fund: "Send SOL here to launch" },
  { id: "eth", label: "Arc + ETH", fund: "Send Arc USDC here to launch" },
  { id: "rh", label: "Robinhood", fund: "Send RH ETH here to launch" },
] as const;

async function loadDesk() {
  const res = await fetch("/api/wallets/desk", { cache: "no-store" });
  const body = await readApiJson<Desk & { error?: string }>(res);
  if (!res.ok) throw new Error(body.error ?? "Desk failed.");
  return body;
}

export function WalletDesk() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadDesk()
      .then(setDesk)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Desk failed."));
  }, []);

  async function copy(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div className="desk-3d space-y-4 rounded-3xl border border-white/10 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Deposit addresses</p>
          <p className="mt-1 max-w-xl text-sm text-white/55">
            Fund these. The pad signs with them. Fees land here. Keys stay off this page.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/wallet/keys">Export keys</Link>
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {CHAINS.map((chain) => {
          const address = desk?.wallets[chain.id];
          return (
            <div key={chain.id} className="desk-tile rounded-2xl border border-white/10 p-4">
              <p className="text-sm font-semibold">{chain.label}</p>
              <p className="mt-1 text-xs text-white/40">{chain.fund}</p>
              <p className="mt-3 break-all font-mono text-xs text-white">{address ?? "—"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!address} onClick={() => address && void copy(address)}>
                  {copied === address ? "Copied" : "Copy address"}
                </Button>
                {desk?.explorers[chain.id] ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={desk.explorers[chain.id]!} target="_blank" rel="noreferrer">
                      Explorer
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

type Revealed = {
  chain: string;
  address?: string;
  secret: string;
  mnemonic: string | null;
  phraseKind?: "hd" | "words";
};

export function WalletKeysDesk() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [shown, setShown] = useState<Revealed | null>(null);
  const [unlock, setUnlock] = useState(false);

  useEffect(() => {
    loadDesk()
      .then(setDesk)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Desk failed."));
  }, []);

  async function act(chain: string, action: "export" | "import") {
    setError(null);
    const res = await fetch("/api/wallets/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, chain, secret: action === "import" ? secret : undefined }),
    });
    const body = await readApiJson<{
      error?: string;
      secret?: string;
      address?: string;
      mnemonic?: string | null;
      phraseKind?: "hd" | "words";
    }>(res);
    if (!res.ok) {
      setError(body.error ?? "Failed.");
      return;
    }
    if (body.secret) {
      setShown({
        chain,
        address: body.address,
        secret: body.secret,
        mnemonic: body.mnemonic ?? null,
        phraseKind: body.phraseKind,
      });
    }
    await loadDesk().then(setDesk).catch(() => undefined);
  }

  return (
    <div className="space-y-4 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-200/70">Danger zone</p>
      <p className="text-sm text-white/60">
        Export shows both the private key and a recovery phrase. Some wallets only accept a phrase. Anyone with either
        can drain the address. Only do this on a device you trust.
      </p>
      {!unlock ? (
        <Button type="button" variant="outline" onClick={() => setUnlock(true)}>
          I understand — show export
        </Button>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {CHAINS.map((chain) => (
              <div key={chain.id} className="rounded-2xl border border-white/10 p-4">
                <p className="text-sm font-semibold">{chain.label}</p>
                <p className="mt-2 break-all font-mono text-[11px] text-white/45">{desk?.wallets[chain.id] ?? "—"}</p>
                <Button type="button" className="mt-3" variant="outline" size="sm" onClick={() => void act(chain.id, "export")}>
                  Reveal key + phrase
                </Button>
              </div>
            ))}
          </div>
          <div>
            <Input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Paste a private key or 12/24-word recovery phrase"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {CHAINS.map((chain) => (
                <Button key={chain.id} type="button" variant="outline" size="sm" onClick={() => void act(chain.id, "import")}>
                  Import {chain.label}
                </Button>
              ))}
            </div>
          </div>
          {shown ? (
            <div className="space-y-3 rounded-2xl border border-amber-300/30 bg-black/40 p-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/70">Private key</p>
                <p className="mt-2 break-all font-mono text-xs">{shown.secret}</p>
                <Button
                  type="button"
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(shown.secret)}
                >
                  Copy private key
                </Button>
              </div>
              {shown.mnemonic ? (
                <div className="border-t border-white/10 pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/70">Recovery phrase</p>
                  <p className="mt-2 text-sm leading-7 text-white">{shown.mnemonic}</p>
                  <p className="mt-2 text-xs text-white/45">
                    {shown.phraseKind === "hd"
                      ? "Restore this 12-word phrase in Phantom, Solflare, MetaMask, Rabby, or Trust. Same wallet as the private key."
                      : "24-word backup of this exact key. Paste it back into OrbitX. In Phantom or MetaMask use Import private key — Restore from phrase in those apps uses different math and will open another address."}
                  </p>
                  <Button
                    type="button"
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => void navigator.clipboard.writeText(shown.mnemonic ?? "")}
                  >
                    Copy recovery phrase
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
