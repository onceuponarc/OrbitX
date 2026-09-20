"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ControlPanel, MetricTile } from "@/components/custom-launch/panel";
import { formatBps } from "@/lib/custom-launch/schema";
import type { ExecuteAction } from "@/lib/custom-launch/onchain/validate";

const ACTION_LABEL: Record<string, string> = {
  claim_fees: "Claim fees",
  creator_claim: "Claim creator fees",
  buyback: "Buyback",
  burn: "Burn",
  buyback_burn: "Buyback & burn",
  holders: "Distribute holders",
  add_liquidity: "Add liquidity",
  treasury: "Treasury action",
  charity: "Execute charity",
  community: "Community",
  flywheel: "Flywheel",
};

type DeskPayload = {
  error?: string;
  author?: boolean;
  capabilities?: { note: string; poolCreate: boolean; buyback: boolean; burn: boolean; addLiquidity: boolean };
  enabledActions?: ExecuteAction[];
  launch?: {
    id: string;
    tokenName: string;
    tokenSymbol: string;
    chain: string;
    status: string;
    tokenAddress: string | null;
    poolAddress: string | null;
    tradeFeeBps: number;
    deployTx: string | null;
  };
  vaults?: { dest: string; quote_balance: string; token_balance: string; chain_address: string | null }[];
  executions?: {
    id: string;
    action: string;
    status: string;
    tx_hash: string | null;
    explorer_url: string | null;
    error: string | null;
    created_at: string;
  }[];
  rules?: { id: string; name: string; status: string; trigger: string; action: string; threshold: number | null }[];
  destinations?: Record<string, string | null>;
};

export function CustomLaunchDevDesk({ slug }: { slug: string }) {
  const [data, setData] = useState<DeskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("0");
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/custom-launch/status?slug=${encodeURIComponent(slug)}`);
    const body = (await response.json()) as DeskPayload;
    if (!response.ok) throw new Error(body.error || "Could not load the desk.");
    setData(body);
  }, [slug]);

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Load failed."));
  }, [load]);

  async function run(action: string) {
    if (!data?.launch?.id) return;
    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/custom-launch/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ launchId: data.launch.id, action, amount }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Execution failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed.");
    } finally {
      setPending(null);
    }
  }

  async function tick() {
    if (!data?.launch?.id) return;
    setPending("automation");
    setError(null);
    try {
      const response = await fetch("/api/custom-launch/automation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ launchId: data.launch.id, amount }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Automation failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Automation failed.");
    } finally {
      setPending(null);
    }
  }

  if (!data?.launch) {
    return <p className="py-10 text-sm text-white/50">{error || "Loading desk…"}</p>;
  }

  const actions = (data.enabledActions ?? []).filter((action) => ACTION_LABEL[action]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 py-8">
      <ControlPanel
        eyebrow="Private creator desk"
        title={`${data.launch.tokenName} · $${data.launch.tokenSymbol}`}
        body={data.capabilities?.note}
        action={
          <Button type="button" variant="outline" asChild>
            <Link href={`/custom/${slug}`}>Public page</Link>
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricTile label="Chain" value={data.launch.chain} />
          <MetricTile label="Status" value={data.launch.status} tone="live" />
          <MetricTile label="Trading fee" value={formatBps(data.launch.tradeFeeBps)} />
          <MetricTile label="Pool" value={data.launch.poolAddress ? "Live" : "Unsupported"} />
        </div>
        <p className="mt-4 break-all font-mono text-xs text-white/45">Token {data.launch.tokenAddress}</p>
      </ControlPanel>

      <ControlPanel eyebrow="Strategy balances" title="Vaults">
        <div className="grid gap-2 sm:grid-cols-2">
          {(data.vaults ?? []).map((vault) => (
            <div key={vault.dest} className="rounded-2xl border border-white/10 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{vault.dest}</p>
              <p className="mt-1 text-sm">Quote {vault.quote_balance} · Token {vault.token_balance}</p>
              {vault.chain_address ? (
                <p className="mt-1 break-all font-mono text-[11px] text-white/35">{vault.chain_address}</p>
              ) : null}
            </div>
          ))}
        </div>
      </ControlPanel>

      <ControlPanel eyebrow="Actions" title="Execute enabled strategies">
        <div className="mb-4 max-w-xs">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Amount (raw units)</label>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1" />
        </div>
        {error ? <p className="mb-3 text-sm text-heat">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              variant={action === "creator_claim" ? "outline" : "default"}
              disabled={Boolean(pending)}
              onClick={() => void run(action)}
            >
              {pending === action ? "Confirming…" : ACTION_LABEL[action]}
            </Button>
          ))}
          <Button type="button" variant="ghost" disabled={Boolean(pending)} onClick={() => void tick()}>
            {pending === "automation" ? "Running…" : "Run automation"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-white/40">
          Claim creator fees never spends buyback, burn, holder, treasury, charity, or community vaults. Liquidity
          removal is not available.
        </p>
      </ControlPanel>

      <ControlPanel eyebrow="Automation" title="Rules">
        {(data.rules ?? []).length === 0 ? (
          <p className="text-sm text-white/45">No persisted rules.</p>
        ) : (
          <ul className="space-y-2">
            {(data.rules ?? []).map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm">
                <span>{rule.name}</span>
                <span className="font-mono text-xs text-white/45">
                  {rule.trigger} → {rule.action} {rule.threshold != null ? `≥ ${rule.threshold}` : ""} · {rule.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ControlPanel>

      <ControlPanel eyebrow="Transactions" title="Execution history">
        {(data.executions ?? []).length === 0 ? (
          <p className="text-sm text-white/45">No executions yet.</p>
        ) : (
          <ul className="space-y-2">
            {(data.executions ?? []).map((row) => (
              <li key={row.id} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    {ACTION_LABEL[row.action] ?? row.action} · {row.status}
                  </span>
                  <span className="font-mono text-[11px] text-white/40">{row.created_at}</span>
                </div>
                {row.tx_hash ? (
                  row.explorer_url ? (
                    <a href={row.explorer_url} className="mt-1 block break-all font-mono text-xs text-gold/80" target="_blank" rel="noreferrer">
                      {row.tx_hash}
                    </a>
                  ) : (
                    <p className="mt-1 break-all font-mono text-xs text-white/50">{row.tx_hash}</p>
                  )
                ) : null}
                {row.error ? <p className="mt-1 text-xs text-heat">{row.error}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </ControlPanel>
    </div>
  );
}
