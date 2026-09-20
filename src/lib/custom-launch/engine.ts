import type { AutomationRule, AutomationSim, CompareOp, TriggerKind } from "./automation.ts";
import { mapRuleAction } from "./onchain/actions.ts";

export type LiveReadings = {
  feeBalance: number;
  marketCap: number;
  volume: number;
  holders: number;
  liquidity: number;
  now: number;
};

export function compare(op: CompareOp, left: number, right: number) {
  if (op === "gte") return left >= right;
  if (op === "lte") return left <= right;
  if (op === "gt") return left > right;
  if (op === "lt") return left < right;
  return left === right;
}

export function readingFor(metric: TriggerKind, live: LiveReadings) {
  if (metric === "fee_balance") return live.feeBalance;
  if (metric === "market_cap") return live.marketCap;
  if (metric === "volume") return live.volume;
  if (metric === "holders") return live.holders;
  if (metric === "liquidity") return live.liquidity;
  if (metric === "milestone") return live.marketCap;
  if (metric === "time") return live.now;
  return 0;
}

export function ruleConditionsMet(rule: AutomationRule, live: LiveReadings) {
  if (rule.status !== "active") return false;
  if (rule.trigger === "manual") return false;
  if (!rule.conditions.length) return false;
  const hits = rule.conditions.map((condition) => {
    if (condition.metric === "time") return true;
    const right = Number(String(condition.value).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(right)) return false;
    return compare(condition.op, readingFor(condition.metric, live), right);
  });
  return rule.join === "and" ? hits.every(Boolean) : hits.some(Boolean);
}

export function cooldownOpen(lastExecutedAt: string | null, cooldownSeconds: number, now = Date.now()) {
  if (!lastExecutedAt || cooldownSeconds <= 0) return true;
  return now - new Date(lastExecutedAt).getTime() >= cooldownSeconds * 1000;
}

export function executableActions(rule: AutomationRule) {
  return rule.actions.map((action) => mapRuleAction(action.kind)).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export function simToLive(sim: AutomationSim): LiveReadings {
  return {
    feeBalance: Number(sim.feeBalance),
    marketCap: Number(sim.marketCap),
    volume: Number(sim.volume),
    holders: Number(sim.holders),
    liquidity: Number(sim.liquidity),
    now: Date.now(),
  };
}
