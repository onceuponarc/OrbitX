"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { readApiJson } from "@/lib/http/read-json";

type Balances = {
  updatedAt?: string;
  solana?: { address: string | null; sol: number; usdc: number };
  ethereum?: { address: string | null; eth: number; usdc: number };
  arc?: { address: string | null; usdc: number };
  robinhood?: { address: string | null; eth: number; usdg: number };
};

function money(n: number, digits = 4) {
  if (!Number.isFinite(n)) return "0";
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-[0.14em] text-white/40">{label}</span>
      <span className="font-mono text-sm text-white">{value}</span>
    </div>
  );
}

export function HoldingsPanel() {
  const [data, setData] = useState<Balances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetch("/api/wallets/balances", { cache: "no-store" })
      .then((res) => readApiJson<Balances & { error?: string }>(res))
      .then((body) => {
        if (!live) return;
        if (body.error) setError(body.error);
        else {
          setError(null);
          setData(body);
        }
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "Balances failed.");
      });
    return () => {
      live = false;
    };
  }, [tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const cards = [
    {
      title: "Solana",
      address: data?.solana?.address,
      lines: [
        { label: "SOL", value: money(data?.solana?.sol ?? 0) },
        { label: "USDC", value: `$${money(data?.solana?.usdc ?? 0, 2)}` },
      ],
    },
    {
      title: "Arc",
      address: data?.arc?.address,
      lines: [{ label: "USDC gas", value: money(data?.arc?.usdc ?? 0) }],
    },
    {
      title: "Ethereum",
      address: data?.ethereum?.address,
      lines: [
        { label: "ETH", value: money(data?.ethereum?.eth ?? 0) },
        { label: "USDC", value: `$${money(data?.ethereum?.usdc ?? 0, 2)}` },
      ],
    },
    {
      title: "Robinhood",
      address: data?.robinhood?.address,
      lines: [
        { label: "ETH", value: money(data?.robinhood?.eth ?? 0) },
        { label: "USDG", value: `$${money(data?.robinhood?.usdg ?? 0, 2)}` },
      ],
    },
  ];

  return (
    <section className="pad-panel space-y-3 rounded-[1.4rem] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Live holdings</p>
          <p className="mt-1 text-sm text-white/55">On-chain balances for the in-app dev wallets. Refreshes every 20s.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setTick((n) => n + 1)}>
          Refresh
        </Button>
      </div>
      <div className="desk-3d grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="desk-tile rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold">{card.title}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-white/40">{card.address ?? "—"}</p>
            <div className="mt-3 space-y-2">
              {card.lines.map((line) => (
                <Row key={line.label} label={line.label} value={line.value} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {data?.updatedAt ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
          {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
