import type { PrintableChain } from "@onceupon/config/solana";
import {
  createAutomationConfig,
  isActionKind,
  isFeeDestinationId,
  isRuleStatus,
  isTriggerKind,
  type ActionKind,
  type AutomationConfig,
  type AutomationRule,
  type CompareOp,
  type Condition,
  type Milestone,
  type RouteShare,
  type RuleAction,
} from "@/lib/custom-launch/automation";
import { createFeeConfig, FEE_DESTINATION_IDS, type FeeConfig } from "@/lib/custom-launch/fees";
import {
  createAdvancedMarketSettings,
  createMarketsConfig,
  createPoolConfig,
  isLiquiditySourceId,
  isPrimaryQuoteId,
  isQuoteAssetId,
  type MarketsConfig,
  type PoolConfig,
  type SecondaryMarket,
} from "@/lib/custom-launch/markets";
import {
  createLaunchModeState,
  isLaunchStrategyId,
  type CustomLaunchModeState,
  type LaunchStrategyId,
  type StrategyIntent,
} from "@/lib/custom-launch/modes";
import { createSupplyPlan, SUPPLY_BUCKETS, type SupplyPlan } from "@/lib/custom-launch/supply";
import { type TokenConfig, type TokenLink } from "@/lib/custom-launch/token";
import { createCustomLaunchDraft, type CustomLaunchDraft } from "@/lib/custom-launch/schema";

export const CUSTOM_LAUNCH_STORAGE_PREFIX = "orbitx.custom-launch.v4.";

export function customLaunchStorageKey(chain: PrintableChain) {
  return `${CUSTOM_LAUNCH_STORAGE_PREFIX}${chain}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseCustomLaunchDraft(raw: unknown, chain: PrintableChain): CustomLaunchDraft | null {
  if (!isRecord(raw) || raw.chain !== chain) return null;
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== 3 && raw.version !== 4) return null;
  const base = createCustomLaunchDraft(chain);
  if (!isRecord(raw.mode) || !isRecord(raw.token) || !isRecord(raw.economics)) return null;
  const mode = parseLaunchMode(raw.mode);

  return {
    ...base,
    version: 4,
    mode,
    token: parseTokenConfig(raw.token, base.token),
    supply: parseSupplyPlan(raw.supply),
    fees: parseFeeConfig(raw.fees, mode),
    economics: { ...base.economics, ...pick(raw.economics, base.economics) },
    markets: parseMarketsConfig(raw.markets),
    automation: parseAutomationConfig(raw.automation),
    reviewedAt: typeof raw.reviewedAt === "string" || raw.reviewedAt === null ? raw.reviewedAt : null,
  };
}

function parseTokenConfig(raw: Record<string, unknown>, fallback: TokenConfig): TokenConfig {
  const picked = { ...fallback, ...pick(raw, { ...fallback, extraLinks: [] }) };
  const extraLinks = Array.isArray(raw.extraLinks)
    ? raw.extraLinks.flatMap((row): TokenLink[] => {
        if (!isRecord(row) || typeof row.label !== "string" || typeof row.url !== "string") return [];
        return [{ label: row.label, url: row.url }];
      })
    : [];
  return { ...picked, extraLinks };
}

function parseSupplyPlan(raw: unknown): SupplyPlan {
  const base = createSupplyPlan();
  if (!isRecord(raw) || !Array.isArray(raw.allocations)) return base;
  const mapped = new Map(base.allocations.map((row) => [row.id, row]));
  for (const row of raw.allocations) {
    if (!isRecord(row) || typeof row.id !== "string") continue;
    const current = mapped.get(row.id as SupplyPlan["allocations"][number]["id"]);
    if (!current) continue;
    mapped.set(current.id, {
      ...current,
      bps: Number.isFinite(Number(row.bps)) ? Math.max(0, Math.min(10_000, Number(row.bps))) : current.bps,
    });
  }
  return { allocations: SUPPLY_BUCKETS.map((bucket) => mapped.get(bucket.id) ?? { ...bucket, bps: 0 }) };
}

function parseFeeConfig(raw: unknown, mode: CustomLaunchModeState): FeeConfig {
  const base = createFeeConfig(mode);
  if (!isRecord(raw)) return base;
  const shares: FeeConfig["shares"] = { ...base.shares };
  if (isRecord(raw.shares)) {
    for (const id of FEE_DESTINATION_IDS) {
      if (id === "orbitx") continue;
      if (typeof raw.shares[id] === "number") shares[id] = Math.max(0, Math.min(10_000, raw.shares[id]));
    }
  }
  return {
    tradingFeeBps:
      typeof raw.tradingFeeBps === "number" ? Math.max(0, Math.min(500, raw.tradingFeeBps)) : base.tradingFeeBps,
    shares,
  };
}

function parsePoolConfig(raw: unknown, fallbackQuote: "sol" | "usdc" | "btc" | "eth" | "other" = "sol"): PoolConfig {
  const base = createPoolConfig(fallbackQuote);
  if (!isRecord(raw)) return base;
  return {
    tokenAllocation: typeof raw.tokenAllocation === "string" ? raw.tokenAllocation : base.tokenAllocation,
    pairedAmount: typeof raw.pairedAmount === "string" ? raw.pairedAmount : base.pairedAmount,
  };
}

function parseMarketsConfig(raw: unknown): MarketsConfig {
  const base = createMarketsConfig();
  if (!isRecord(raw)) return base;
  const primaryRaw = isRecord(raw.primary) ? raw.primary : {};
  const quote = isPrimaryQuoteId(primaryRaw.quote) ? primaryRaw.quote : base.primary.quote;
  const advancedRaw = isRecord(primaryRaw.advanced) ? primaryRaw.advanced : {};
  const advancedBase = createAdvancedMarketSettings();
  const secondary = Array.isArray(raw.secondary)
    ? raw.secondary.flatMap((row): SecondaryMarket[] => {
        if (!isRecord(row) || !isQuoteAssetId(row.quote)) return [];
        return [
          {
            id: typeof row.id === "string" ? row.id : `mkt-${row.quote}`,
            quote: row.quote,
            customTicker: typeof row.customTicker === "string" ? row.customTicker : "",
            pool: parsePoolConfig(row.pool, row.quote),
          },
        ];
      })
    : [];
  const accessRaw = isRecord(raw.access) ? raw.access : {};
  return {
    primary: {
      quote,
      pool: parsePoolConfig(primaryRaw.pool, quote),
      liquidity: {
        source: isRecord(primaryRaw.liquidity) && isLiquiditySourceId(primaryRaw.liquidity.source)
          ? primaryRaw.liquidity.source
          : base.primary.liquidity.source,
      },
      advanced: {
        slippageBps:
          typeof advancedRaw.slippageBps === "number"
            ? Math.max(0, Math.min(5000, advancedRaw.slippageBps))
            : advancedBase.slippageBps,
        priceInit: advancedRaw.priceInit === "manual" ? "manual" : "auto",
        lockEnabled: typeof advancedRaw.lockEnabled === "boolean" ? advancedRaw.lockEnabled : advancedBase.lockEnabled,
        lockDays:
          typeof advancedRaw.lockDays === "number"
            ? Math.max(0, Math.min(1825, advancedRaw.lockDays))
            : advancedBase.lockDays,
        routingPreference:
          advancedRaw.routingPreference === "best_price" || advancedRaw.routingPreference === "manual"
            ? advancedRaw.routingPreference
            : "primary_first",
        activation:
          advancedRaw.activation === "manual" || advancedRaw.activation === "on_target"
            ? advancedRaw.activation
            : "immediate",
        secondaryActivation:
          advancedRaw.secondaryActivation === "after_primary" || advancedRaw.secondaryActivation === "on_liquidity"
            ? advancedRaw.secondaryActivation
            : "manual",
      },
    },
    secondary,
    access: {
      primaryEnabled: typeof accessRaw.primaryEnabled === "boolean" ? accessRaw.primaryEnabled : true,
      secondaryEnabled: typeof accessRaw.secondaryEnabled === "boolean" ? accessRaw.secondaryEnabled : true,
      laterConnections: typeof accessRaw.laterConnections === "boolean" ? accessRaw.laterConnections : true,
    },
  };
}

function parseAutomationConfig(raw: unknown): AutomationConfig {
  const base = createAutomationConfig();
  if (!isRecord(raw)) return base;
  const rules = Array.isArray(raw.rules)
    ? raw.rules.flatMap((row): AutomationRule[] => {
        if (!isRecord(row) || typeof row.name !== "string" || !isTriggerKind(row.trigger)) return [];
        const conditions = Array.isArray(row.conditions)
          ? row.conditions.flatMap((item): Condition[] => {
              if (!isRecord(item) || !isTriggerKind(item.metric)) return [];
              const op = ["gte", "lte", "gt", "lt", "eq"].includes(String(item.op)) ? (item.op as CompareOp) : "gte";
              return [
                {
                  id: typeof item.id === "string" ? item.id : `c-${item.metric}`,
                  metric: item.metric,
                  op,
                  value: typeof item.value === "string" ? item.value : "",
                },
              ];
            })
          : [];
        const actions = Array.isArray(row.actions)
          ? row.actions.flatMap((item): RuleAction[] => {
              if (!isRecord(item) || !isActionKind(item.kind)) return [];
              return [
                {
                  id: typeof item.id === "string" ? item.id : `a-${item.kind}`,
                  kind: item.kind,
                  note: typeof item.note === "string" ? item.note : "",
                },
              ];
            })
          : [];
        const routes = Array.isArray(row.routes)
          ? row.routes.flatMap((item): RouteShare[] => {
              if (!isRecord(item) || !isFeeDestinationId(item.destination)) return [];
              return [
                {
                  id: typeof item.id === "string" ? item.id : item.destination,
                  destination: item.destination,
                  bps: Number.isFinite(Number(item.bps)) ? Math.max(0, Math.min(10_000, Number(item.bps))) : 0,
                },
              ];
            })
          : [];
        return [
          {
            id: typeof row.id === "string" ? row.id : `rule-${row.trigger}`,
            name: row.name,
            status: isRuleStatus(row.status) ? row.status : "draft",
            trigger: row.trigger,
            conditions,
            join: row.join === "or" ? "or" : "and",
            actions,
            routes,
            cooldown: typeof row.cooldown === "string" ? row.cooldown : "1h",
            maxExecution: typeof row.maxExecution === "string" ? row.maxExecution : "1000",
            lastExecution: typeof row.lastExecution === "string" ? row.lastExecution : null,
            nextExecution: typeof row.nextExecution === "string" ? row.nextExecution : "Not scheduled — preview only",
          },
        ];
      })
    : [];
  const milestones = Array.isArray(raw.milestones)
    ? raw.milestones.flatMap((row): Milestone[] => {
        if (!isRecord(row) || typeof row.marketCap !== "string" || !isActionKind(row.action)) return [];
        return [
          {
            id: typeof row.id === "string" ? row.id : `ms-${row.marketCap}`,
            marketCap: row.marketCap,
            action: row.action as ActionKind,
          },
        ];
      })
    : base.milestones;
  const sim = isRecord(raw.simulation) ? raw.simulation : {};
  return {
    rules,
    milestones,
    simulation: {
      feeBalance: typeof sim.feeBalance === "string" ? sim.feeBalance : base.simulation.feeBalance,
      marketCap: typeof sim.marketCap === "string" ? sim.marketCap : base.simulation.marketCap,
      holders: typeof sim.holders === "string" ? sim.holders : base.simulation.holders,
      volume: typeof sim.volume === "string" ? sim.volume : base.simulation.volume,
      liquidity: typeof sim.liquidity === "string" ? sim.liquidity : base.simulation.liquidity,
    },
  };
}

function parseLaunchMode(raw: Record<string, unknown>): CustomLaunchModeState {
  const base = createLaunchModeState();
  const primary = isLaunchStrategyId(raw.primary) ? raw.primary : base.primary;
  const modules = Array.isArray(raw.modules)
    ? raw.modules.filter((id): id is LaunchStrategyId => isLaunchStrategyId(id) && id !== primary)
    : [];
  const inspected = isLaunchStrategyId(raw.inspected) ? raw.inspected : primary;
  const intents: CustomLaunchModeState["intents"] = {};
  if (isRecord(raw.intents)) {
    for (const [key, value] of Object.entries(raw.intents)) {
      if (!isLaunchStrategyId(key) || !isRecord(value)) continue;
      intents[key] = {
        allocationBps: Number(value.allocationBps) || 2000,
        threshold: typeof value.threshold === "string" ? value.threshold : "1.0",
        maxAmount: typeof value.maxAmount === "string" ? value.maxAmount : "10",
        frequency: typeof value.frequency === "string" ? value.frequency : "weekly",
        wallet: typeof value.wallet === "string" ? value.wallet : "",
        charityId: typeof value.charityId === "string" ? value.charityId : "water",
      } satisfies StrategyIntent;
    }
  }
  return {
    primary,
    modules,
    inspected,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    intents,
  };
}

function pick<T extends Record<string, unknown>>(source: Record<string, unknown>, shape: T): Partial<T> {
  const next: Partial<T> = {};
  for (const key of Object.keys(shape) as (keyof T)[]) {
    if (!(key in source)) continue;
    const incoming = source[key as string];
    const current = shape[key];
    if (incoming === null || current === null || typeof incoming === typeof current) {
      next[key] = incoming as T[keyof T];
    }
  }
  return next;
}

export function readCustomLaunchDraft(chain: PrintableChain): CustomLaunchDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(customLaunchStorageKey(chain));
    if (!raw) return null;
    return parseCustomLaunchDraft(JSON.parse(raw), chain);
  } catch {
    return null;
  }
}

export function writeCustomLaunchDraft(chain: PrintableChain, draft: CustomLaunchDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(customLaunchStorageKey(chain), JSON.stringify(draft));
}

export function clearCustomLaunchDraft(chain: PrintableChain) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(customLaunchStorageKey(chain));
}

type Listener = () => void;

const listeners = new Map<PrintableChain, Set<Listener>>();
const snapshots = new Map<PrintableChain, CustomLaunchDraft>();

function emit(chain: PrintableChain) {
  listeners.get(chain)?.forEach((listener) => listener());
}

export function subscribeCustomLaunchDraft(chain: PrintableChain, listener: Listener) {
  let set = listeners.get(chain);
  if (!set) {
    set = new Set();
    listeners.set(chain, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export function getCustomLaunchDraftSnapshot(chain: PrintableChain) {
  const cached = snapshots.get(chain);
  if (cached) return cached;
  const draft = readCustomLaunchDraft(chain) ?? createCustomLaunchDraft(chain);
  snapshots.set(chain, draft);
  return draft;
}

const serverSnapshots = new Map<PrintableChain, CustomLaunchDraft>();

export function getCustomLaunchDraftServerSnapshot(chain: PrintableChain) {
  const cached = serverSnapshots.get(chain);
  if (cached) return cached;
  const draft = createCustomLaunchDraft(chain);
  serverSnapshots.set(chain, draft);
  return draft;
}

export function setCustomLaunchDraft(chain: PrintableChain, draft: CustomLaunchDraft) {
  snapshots.set(chain, draft);
  writeCustomLaunchDraft(chain, draft);
  emit(chain);
}

export function resetCustomLaunchDraft(chain: PrintableChain) {
  const draft = createCustomLaunchDraft(chain);
  snapshots.set(chain, draft);
  clearCustomLaunchDraft(chain);
  emit(chain);
}
