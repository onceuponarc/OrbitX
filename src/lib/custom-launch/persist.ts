import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { resolvedFeeAllocations } from "@/lib/custom-launch/fees";
import { quoteTicker } from "@/lib/custom-launch/markets";
import { mapRuleAction } from "@/lib/custom-launch/onchain/actions";
import type { DeployResult } from "@/lib/custom-launch/onchain/types";
import type { PrintableChain } from "@onceupon/config/solana";
import type { HolderLine } from "@/lib/custom-launch/recipients";

export type LaunchRow = {
  id: string;
  author_user_id: string;
  chain: PrintableChain;
  slug: string;
  status: string;
  config: CustomLaunchDraft;
  token_name: string;
  token_symbol: string;
  decimals: number;
  supply: string;
  trade_fee_bps: number;
  token_address: string | null;
  pool_address: string | null;
  router_address: string | null;
  hub_address: string | null;
  factory_address: string | null;
  metadata_uri: string | null;
  quote_address: string | null;
  creator_address: string | null;
  charity_address: string | null;
  treasury_address: string | null;
  community_address: string | null;
  deploy_tx: string | null;
  deploy_error: string | null;
  deployed_at: string | null;
  paused: boolean;
};

export type ExecutionRow = {
  id: string;
  launch_id: string;
  action: string;
  exec_id: string;
  status: string;
  amount: string | null;
  received: string | null;
  tx_hash: string | null;
  explorer_url: string | null;
  error: string | null;
  public_event: boolean;
  created_at: string;
  confirmed_at: string | null;
};

function db() {
  return createServiceClient();
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "token";
}

export async function insertPreparingLaunch(input: {
  userId: string;
  draft: CustomLaunchDraft;
  creatorAddress: string;
  charity?: string;
  treasury?: string;
  community?: string;
  quoteAddress?: string;
}): Promise<LaunchRow> {
  const slug = `${slugify(input.draft.token.symbol || input.draft.token.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await db()
    .from("custom_launches")
    .insert({
      author_user_id: input.userId,
      chain: input.draft.chain,
      slug,
      status: "preparing",
      config: input.draft,
      token_name: input.draft.token.name,
      token_symbol: input.draft.token.symbol.toUpperCase(),
      decimals: input.draft.token.decimals,
      supply: input.draft.token.supply.replace(/[^\d]/g, "") || "0",
      trade_fee_bps: input.draft.fees.tradingFeeBps,
      metadata_uri: input.draft.token.imageUrl || null,
      creator_address: input.creatorAddress,
      charity_address: input.charity ?? null,
      treasury_address: input.treasury ?? null,
      community_address: input.community ?? null,
      quote_address: input.quoteAddress ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not persist Custom Launch.");
  await persistConfigRows(data.id as string, input.draft);
  return data as LaunchRow;
}

export async function persistConfigRows(launchId: string, draft: CustomLaunchDraft) {
  const splits = resolvedFeeAllocations(draft.mode, draft.fees).map((row) => ({
    launch_id: launchId,
    dest: row.id,
    bps: row.bps,
  }));
  const supabase = db();
  if (splits.length) {
    const { error } = await supabase.from("custom_launch_splits").upsert(splits);
    if (error) throw new Error(error.message);
  }
  const vaults = splits.map((row) => ({ launch_id: launchId, dest: row.dest }));
  if (vaults.length) {
    const { error } = await supabase.from("custom_launch_vaults").upsert(vaults);
    if (error) throw new Error(error.message);
  }
  const { error: marketError } = await supabase.from("custom_launch_markets").insert({
    launch_id: launchId,
    role: "primary",
    quote_symbol: draft.markets.primary.quote,
    token_liquidity: draft.markets.primary.pool.tokenAllocation || null,
    quote_liquidity: draft.markets.primary.pool.pairedAmount || null,
    status: "pending",
  });
  if (marketError) throw new Error(marketError.message);
  for (const market of draft.markets.secondary) {
    const { error } = await supabase.from("custom_launch_markets").insert({
      launch_id: launchId,
      role: "secondary",
      quote_symbol: quoteTicker(market.quote, market.customTicker),
      token_liquidity: market.pool.tokenAllocation || null,
      quote_liquidity: market.pool.pairedAmount || null,
      status: "unsupported",
    });
    if (error) throw new Error(error.message);
  }
  for (const rule of draft.automation.rules) {
    const action = mapRuleAction(rule.actions[0]?.kind ?? "claim_fees");
    if (!action) continue;
    const threshold = Number(rule.conditions.find((row) => row.metric === "fee_balance")?.value ?? rule.maxExecution ?? 0);
    const { error } = await supabase.from("custom_launch_rules").insert({
      launch_id: launchId,
      name: rule.name,
      status: rule.status,
      trigger: rule.trigger,
      action,
      config: rule,
      threshold: Number.isFinite(threshold) ? threshold : null,
      cooldown_seconds: parseCooldown(rule.cooldown),
      max_execution: rule.maxExecution || null,
    });
    if (error) throw new Error(error.message);
  }
  for (const milestone of draft.automation.milestones) {
    const action = mapRuleAction(milestone.action);
    if (!action) continue;
    const { error } = await supabase.from("custom_launch_milestones").insert({
      launch_id: launchId,
      market_cap: milestone.marketCap,
      action,
    });
    if (error) throw new Error(error.message);
  }
}

function parseCooldown(value: string) {
  if (value.endsWith("h")) return Number(value.slice(0, -1)) * 3600;
  if (value.endsWith("d")) return Number(value.slice(0, -1)) * 86400;
  if (value.endsWith("m")) return Number(value.slice(0, -1)) * 60;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function markLaunchDeploying(id: string) {
  await db().from("custom_launches").update({ status: "deploying", updated_at: new Date().toISOString() }).eq("id", id);
}

export async function markLaunchLive(id: string, result: DeployResult, extras?: { vaults?: Record<string, string>; poolStatus?: string }) {
  if (!result.txHash) throw new Error("Cannot mark a Custom Launch live without a confirmed transaction.");
  const { error } = await db()
    .from("custom_launches")
    .update({
      status: "live",
      token_address: result.tokenAddress,
      pool_address: result.poolAddress,
      router_address: result.routerAddress,
      hub_address: result.hubAddress,
      factory_address: result.factoryAddress,
      deploy_tx: result.txHash,
      deploy_error: null,
      deployed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (extras?.vaults) {
    for (const [dest, chain_address] of Object.entries(extras.vaults)) {
      await db().from("custom_launch_vaults").upsert({ launch_id: id, dest, chain_address });
    }
  }
  await db()
    .from("custom_launch_markets")
    .update({
      pool_address: result.poolAddress,
      status: extras?.poolStatus ?? (result.poolAddress ? "live" : "unsupported"),
    })
    .eq("launch_id", id)
    .eq("role", "primary");
}

export async function markLaunchFailed(id: string, message: string) {
  await db()
    .from("custom_launches")
    .update({ status: "failed", deploy_error: message, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function loadLaunchById(id: string) {
  const { data, error } = await db().from("custom_launches").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LaunchRow | null) ?? null;
}

export async function loadLaunchBySlug(slug: string) {
  const { data, error } = await db().from("custom_launches").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LaunchRow | null) ?? null;
}

export async function loadSplits(launchId: string) {
  const { data, error } = await db().from("custom_launch_splits").select("*").eq("launch_id", launchId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadVaults(launchId: string) {
  const { data, error } = await db().from("custom_launch_vaults").select("*").eq("launch_id", launchId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadRules(launchId: string) {
  const { data, error } = await db().from("custom_launch_rules").select("*").eq("launch_id", launchId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadMarkets(launchId: string) {
  const { data, error } = await db().from("custom_launch_markets").select("*").eq("launch_id", launchId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function insertDistributions(input: {
  launchId: string;
  executionId: string;
  recipients: HolderLine[];
  txHash: string;
}) {
  if (!input.recipients.length) return;
  const { error } = await db().from("custom_launch_distributions").insert(
    input.recipients.map((row) => ({
      launch_id: input.launchId,
      execution_id: input.executionId,
      recipient: row.address,
      amount: row.amount,
      tx_hash: input.txHash,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function loadPublicExecutions(launchId: string) {
  const { data, error } = await db()
    .from("custom_launch_executions")
    .select("*")
    .eq("launch_id", launchId)
    .eq("public_event", true)
    .in("status", ["completed", "burned"])
    .not("tx_hash", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExecutionRow[];
}

export async function loadAuthorExecutions(launchId: string) {
  const { data, error } = await db()
    .from("custom_launch_executions")
    .select("*")
    .eq("launch_id", launchId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExecutionRow[];
}

export async function insertExecution(input: {
  launchId: string;
  action: string;
  execId: string;
  amount?: string;
  publicEvent?: boolean;
  ruleId?: string;
}) {
  const { data, error } = await db()
    .from("custom_launch_executions")
    .insert({
      launch_id: input.launchId,
      rule_id: input.ruleId ?? null,
      action: input.action,
      exec_id: input.execId,
      status: "pending",
      amount: input.amount ?? null,
      public_event: input.publicEvent !== false,
    })
    .select("*")
    .single();
  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
      throw new Error("Duplicate Custom Launch execution.");
    }
    throw new Error(error.message);
  }
  return data as ExecutionRow;
}

export async function updateExecution(
  id: string,
  patch: Partial<Pick<ExecutionRow, "status" | "tx_hash" | "explorer_url" | "error" | "received" | "confirmed_at">>,
) {
  if ((patch.status === "completed" || patch.status === "burned") && !patch.tx_hash) {
    throw new Error("Completed executions require a confirmed transaction hash.");
  }
  const { error } = await db().from("custom_launch_executions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function touchRule(ruleId: string) {
  const { data } = await db().from("custom_launch_rules").select("execution_count").eq("id", ruleId).maybeSingle();
  await db()
    .from("custom_launch_rules")
    .update({
      last_executed_at: new Date().toISOString(),
      execution_count: (data?.execution_count ?? 0) + 1,
    })
    .eq("id", ruleId);
}

export async function updateVaultBalances(launchId: string, dest: string, quote?: string, token?: string) {
  const patch: Record<string, unknown> = { synced_at: new Date().toISOString() };
  if (quote !== undefined) patch.quote_balance = quote;
  if (token !== undefined) patch.token_balance = token;
  await db().from("custom_launch_vaults").update(patch).eq("launch_id", launchId).eq("dest", dest);
}

export async function publicLaunchView(launch: LaunchRow) {
  const [splits, markets] = await Promise.all([loadSplits(launch.id), loadMarkets(launch.id)]);
  return {
    id: launch.id,
    slug: launch.slug,
    chain: launch.chain,
    status: launch.status,
    tokenName: launch.token_name,
    tokenSymbol: launch.token_symbol,
    decimals: launch.decimals,
    supply: launch.supply,
    tradeFeeBps: launch.trade_fee_bps,
    tokenAddress: launch.token_address,
    poolAddress: launch.pool_address,
    deployTx: launch.deploy_tx,
    deployedAt: launch.deployed_at,
    splits: splits.map((row) => ({ dest: row.dest as string, bps: row.bps as number })),
    markets: markets.map((row) => ({
      role: row.role as string,
      quote: row.quote_symbol as string,
      poolAddress: (row.pool_address as string | null) ?? null,
      status: row.status as string,
      tokenLiquidity: (row.token_liquidity as string | null) ?? null,
      quoteLiquidity: (row.quote_liquidity as string | null) ?? null,
    })),
    imageUrl: launch.config?.token?.imageUrl ?? launch.metadata_uri,
    description: launch.config?.token?.description ?? "",
    socials: {
      website: launch.config?.token?.website ?? "",
      twitter: launch.config?.token?.twitter ?? "",
      telegram: launch.config?.token?.telegram ?? "",
      discord: launch.config?.token?.discord ?? "",
    },
  };
}
