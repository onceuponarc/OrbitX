"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { feeExample } from "@onceupon/config/copy";
import { CHAPTER } from "@onceupon/config/chapter";
import { ARC_NETWORKS } from "@/lib/arc/keys";

export function ToolsDesk() {
  const [buy, setBuy] = useState("1000");
  const [bps, setBps] = useState("100");
  const [raised, setRaised] = useState("1200");
  const graduate = CHAPTER.graduateQuoteUi;
  const progress = Math.min(100, (Number(raised) / graduate) * 100);
  const [note, setNote] = useState<string | null>(null);

  async function addTestnet() {
    const eth = (
      window as Window & {
        ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
      }
    ).ethereum;
    if (!eth) {
      setNote("Install MetaMask or Rabby first.");
      return;
    }
    try {
      await eth.request({ method: "wallet_addEthereumChain", params: [ARC_NETWORKS.testnet] });
      setNote("Arc Testnet added.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Wallet rejected.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Tools</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Pad tools</h1>
        <p className="mt-3 max-w-2xl text-white/60">
          Fee math, graduation progress, and Arc network injectors. This is not a broker terminal.
        </p>
        <p className="mt-3 text-sm text-white/50">
          Official token and the 75/25 pad split on <a className="text-white underline" href="/params">/params</a>. $ORBITX is live on Solana.
        </p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 p-5">
          <h2 className="text-xl font-semibold">Creator fee</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input value={buy} onChange={(e) => setBuy(e.target.value)} />
            <Input value={bps} onChange={(e) => setBps(e.target.value)} />
          </div>
          <p className="mt-3 text-sm text-white/65">{feeExample(Number(buy) || 0, Number(bps) || 0)}</p>
        </section>
        <section className="rounded-2xl border border-white/10 p-5">
          <h2 className="text-xl font-semibold">Graduation</h2>
          <p className="mt-1 text-sm text-white/50">Target {graduate.toLocaleString("en-US")} USDC</p>
          <Input className="mt-4" value={raised} onChange={(e) => setRaised(e.target.value)} />
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 font-mono text-sm">{progress.toFixed(1)}%</p>
        </section>
      </div>
      <section className="rounded-2xl border border-white/10 p-5">
        <h2 className="text-xl font-semibold">Add Arc to a wallet</h2>
        <p className="mt-2 text-sm text-white/55">
          Arc mainnet RPC <span className="font-mono">https://rpc.mainnet.arc.io</span> · chain 5042 · USDC gas.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void addTestnet()}>
            Add Arc
          </Button>
          <Button asChild variant="outline">
            <a href="/wallet">Open wallet desk</a>
          </Button>
        </div>
        {note ? <p className="mt-3 text-sm text-white/70">{note}</p> : null}
      </section>
    </div>
  );
}
