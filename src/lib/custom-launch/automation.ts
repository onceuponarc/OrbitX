import {
  FEE_DESTINATION_IDS,
  FEE_DESTINATIONS,
  resolvedFeeAllocations,
  type FeeConfig,
  type FeeDestinationId,
} from "./fees.ts";
import type { CustomLaunchModeState } from "./modes.ts";
import { ORBITX_PROTOCOL } from "./protocol.ts";

export const TRIGGER_KINDS = [
  "fee_balance",
  "market_cap",
  "volume",
  "holders",
  "liquidity",
  "time",
  "milestone",
  "manual",
] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

export const COMPARE_OPS = ["gte", "lte", "gt", "lt", "eq"] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const ACTION_KINDS = [
  "claim_fees",
  "distribute_fees",
  "buyback",
  "burn",
  "add_liquidity",
  "remove_liquidity",
  "send_treasury",
  "send_creator",
  "send_charity",
  "reward_holders",
  "execute_flywheel",
  "trigger_rule",
  "custom",
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const RULE_STATUSES = ["active", "draft", "paused", "completed"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export type LogicJoin = "and" | "or";

export type Condition = {
  id: string;
  metric: TriggerKind;
  op: CompareOp;
  value: string;
};

export type RuleAction = {
  id: string;
  kind: ActionKind;
  note: string;
};

export type RouteShare = {
  id: string;
  destination: FeeDestinationId;
  bps: number;
};

export type AutomationRule = {
  id: string;
  name: string;
  status: RuleStatus;
  trigger: TriggerKind;
  conditions: Condition[];
  join: LogicJoin;
  actions: RuleAction[];
  routes: RouteShare[];
  cooldown: string;
  maxExecution: string;
  lastExecution: string | null;
  nextExecution: string | null;
};

export type Milestone = {
  id: string;
  marketCap: string;
  action: ActionKind;
};

export type AutomationSim = {
  feeBalance: string;
  marketCap: string;
  holders: string;
  volume: string;
  liquidity: string;
};

export type AutomationConfig = {
  rules: AutomationRule[];
  milestones: Milestone[];
  simulation: AutomationSim;
};

export const TRIGGER_META: Record<TriggerKind, { label: string; body: string; unit: string; presets: string[] }> = {
  fee_balance: {
    label: "Fee balance",
    body: "When accrued trading fees reach a threshold.",
    unit: "USD",
    presets: ["100", "500", "1000"],
  },
  market_cap: {
    label: "Market cap",
    body: "When estimated market cap crosses a level.",
    unit: "USD",
    presets: ["10000", "50000", "100000"],
  },
  volume: {
    label: "Trading volume",
    body: "When cumulative volume crosses a mark.",
    unit: "USD",
    presets: ["10000", "100000"],
  },
  holders: {
    label: "Holder count",
    body: "When unique holders reach a count.",
    unit: "holders",
    presets: ["100", "1000"],
  },
  liquidity: {
    label: "Liquidity",
    body: "When paired liquidity crosses a band.",
    unit: "USD",
    presets: ["10000"],
  },
  time: {
    label: "Time",
    body: "On a repeating interval. UI schedule only.",
    unit: "interval",
    presets: ["1h", "1d", "1w"],
  },
  milestone: {
    label: "Milestone",
    body: "When a configured launch milestone is hit.",
    unit: "USD MC",
    presets: ["10000", "50000", "100000"],
  },
  manual: {
    label: "Manual",
    body: "Armed for a later manual trigger. Not executed here.",
    unit: "",
    presets: [],
  },
};

export const ACTION_META: Record<ActionKind, { label: string; body: string }> = {
  claim_fees: { label: "Claim fees", body: "Pull accrued fees into the router." },
  distribute_fees: { label: "Distribute fees", body: "Split claimed fees across destinations." },
  buyback: { label: "Buyback", body: "Queue a buyback from the fee pot." },
  burn: { label: "Burn", body: "Mark tokens for a burn." },
  add_liquidity: { label: "Add liquidity", body: "Route size into the configured pair." },
  remove_liquidity: { label: "Remove liquidity", body: "Unwind LP — configuration only." },
  send_treasury: { label: "Send to treasury", body: "Forward a slice to treasury." },
  send_creator: { label: "Send to creator", body: "Forward a slice to the creator desk." },
  send_charity: { label: "Send to charity", body: "Forward the charity allocation." },
  reward_holders: { label: "Reward holders", body: "Distribute to eligible holders." },
  execute_flywheel: { label: "Execute flywheel", body: "Run the stacked flywheel sequence." },
  trigger_rule: { label: "Trigger another rule", body: "Chain into a second local rule." },
  custom: { label: "Custom action", body: "Placeholder for a later custom verb." },
};

export const COMPARE_META: Record<CompareOp, string> = {
  gte: "≥",
  lte: "≤",
  gt: ">",
  lt: "<",
  eq: "=",
};

export const RULE_STATUS_META: Record<RuleStatus, string> = {
  active: "Active",
  draft: "Draft",
  paused: "Paused",
  completed: "Completed",
};

function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCondition(metric: TriggerKind, value = TRIGGER_META[metric].presets[0] ?? ""): Condition {
  return {
    id: nid("c"),
    metric,
    op: metric === "liquidity" ? "gte" : "gte",
    value,
  };
}

export function createAction(kind: ActionKind): RuleAction {
  return { id: nid("a"), kind, note: "" };
}

export function defaultRoutes(mode: CustomLaunchModeState, fees: FeeConfig): RouteShare[] {
  return resolvedFeeAllocations(mode, fees).map((row) => ({
    id: row.id,
    destination: row.id,
    bps: row.bps,
  }));
}

export function createRule(
  partial: Partial<AutomationRule> & Pick<AutomationRule, "name" | "trigger">,
  mode: CustomLaunchModeState,
  fees: FeeConfig,
): AutomationRule {
  return {
    id: nid("rule"),
    status: "draft",
    conditions: partial.trigger === "manual" ? [] : [createCondition(partial.trigger)],
    join: "and",
    actions: [createAction("claim_fees"), createAction("distribute_fees")],
    routes: defaultRoutes(mode, fees),
    cooldown: "1h",
    maxExecution: "1000",
    lastExecution: null,
    nextExecution: "Not scheduled — preview only",
    ...partial,
  };
}

export function createAutomationConfig(): AutomationConfig {
  return {
    rules: [],
    milestones: [
      { id: "ms-10k", marketCap: "10000", action: "add_liquidity" },
      { id: "ms-25k", marketCap: "25000", action: "reward_holders" },
      { id: "ms-50k", marketCap: "50000", action: "buyback" },
      { id: "ms-100k", marketCap: "100000", action: "send_charity" },
      { id: "ms-500k", marketCap: "500000", action: "burn" },
    ],
    simulation: {
      feeBalance: "127.40",
      marketCap: "42500",
      holders: "612",
      volume: "18400",
      liquidity: "5000",
    },
  };
}

export type RuleTemplateId = "auto_distribute" | "flywheel" | "holder_rewards" | "charity" | "milestone";

export const RULE_TEMPLATES: {
  id: RuleTemplateId;
  name: string;
  body: string;
  build: (mode: CustomLaunchModeState, fees: FeeConfig) => AutomationRule;
}[] = [
  {
    id: "auto_distribute",
    name: "Auto distribute",
    body: "Fees ≥ $100 → Claim → Distribute",
    build: (mode, fees) =>
      createRule(
        {
          name: "Fee distribution",
          status: "active",
          trigger: "fee_balance",
          nextExecution: "When fees ≥ $100 — preview",
        },
        mode,
        fees,
      ),
  },
  {
    id: "flywheel",
    name: "Flywheel",
    body: "Fees ≥ $100 → Buyback → Add liquidity",
    build: (mode, fees) =>
      createRule(
        {
          name: "Flywheel",
          status: "active",
          trigger: "fee_balance",
          actions: [
            createAction("claim_fees"),
            createAction("buyback"),
            createAction("add_liquidity"),
            createAction("execute_flywheel"),
          ],
          nextExecution: "When fees ≥ $100 — preview",
        },
        mode,
        fees,
      ),
  },
  {
    id: "holder_rewards",
    name: "Holder rewards",
    body: "Fees ≥ $100 → Claim → Holders",
    build: (mode, fees) =>
      createRule(
        {
          name: "Holder rewards",
          status: "active",
          trigger: "fee_balance",
          actions: [createAction("claim_fees"), createAction("reward_holders")],
          nextExecution: "When fees ≥ $100 — preview",
        },
        mode,
        fees,
      ),
  },
  {
    id: "charity",
    name: "Charity",
    body: "Fees ≥ $100 → Claim → Charity route",
    build: (mode, fees) =>
      createRule(
        {
          name: "Charity distribution",
          status: "active",
          trigger: "fee_balance",
          actions: [createAction("claim_fees"), createAction("send_charity")],
          nextExecution: "When fees ≥ $100 — preview",
        },
        mode,
        fees,
      ),
  },
  {
    id: "milestone",
    name: "Milestone",
    body: "MC ≥ configured → Execute action",
    build: (mode, fees) =>
      createRule(
        {
          name: "Market-cap milestone",
          status: "draft",
          trigger: "milestone",
          conditions: [createCondition("market_cap", "100000")],
          actions: [createAction("add_liquidity")],
          nextExecution: "When MC ≥ $100K — preview",
        },
        mode,
        fees,
      ),
  },
];

export function routeAllocatedBps(routes: RouteShare[]) {
  return routes.reduce((sum, row) => sum + row.bps, 0);
}

export function routesExact(routes: RouteShare[]) {
  return routeAllocatedBps(routes) === 10_000;
}

export function routesOver(routes: RouteShare[]) {
  return routeAllocatedBps(routes) > 10_000;
}

export function ruleNeedsRoutes(rule: AutomationRule) {
  return rule.actions.some((action) =>
    ["distribute_fees", "execute_flywheel", "reward_holders"].includes(action.kind),
  );
}

export function ruleError(rule: AutomationRule) {
  if (!rule.name.trim()) return "Name this rule.";
  if (rule.trigger !== "manual" && rule.conditions.length === 0) return "Add at least one condition.";
  if (rule.conditions.some((row) => row.metric !== "time" && row.metric !== "manual" && !row.value.trim())) {
    return "Complete every condition value.";
  }
  if (rule.actions.length === 0) return "Add at least one action.";
  if (ruleNeedsRoutes(rule) && routesOver(rule.routes)) return "Route allocation exceeds 100%.";
  if (ruleNeedsRoutes(rule) && !routesExact(rule.routes)) return "Route allocation must total 100%.";
  return undefined;
}

export function automationComplete(config: AutomationConfig) {
  return config.rules.every((rule) => !ruleError(rule));
}

export function formatTriggerLine(rule: AutomationRule) {
  if (rule.trigger === "manual") return "Manual";
  const first = rule.conditions[0];
  if (!first) return TRIGGER_META[rule.trigger].label;
  const extra = rule.conditions.length > 1 ? ` ${rule.join.toUpperCase()} +${rule.conditions.length - 1}` : "";
  return `${TRIGGER_META[first.metric].label} ${COMPARE_META[first.op]} ${formatConditionValue(first)}${extra}`;
}

export function formatConditionValue(condition: Condition) {
  if (condition.metric === "time") return condition.value || "interval";
  if (condition.metric === "holders") return condition.value || "0";
  if (!condition.value) return "—";
  const amount = Number(condition.value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount)) return condition.value;
  return `$${amount.toLocaleString("en-US")}`;
}

export function formatActionLine(rule: AutomationRule) {
  if (rule.actions.length === 0) return "No action";
  return rule.actions.map((action) => ACTION_META[action.kind].label).join(" → ");
}

export function formatDestinationLine(rule: AutomationRule) {
  if (rule.routes.length === 0) return "—";
  return rule.routes
    .filter((row) => row.bps > 0)
    .map((row) => FEE_DESTINATIONS[row.destination].label)
    .join(" / ");
}

export function duplicateRule(rule: AutomationRule): AutomationRule {
  return {
    ...rule,
    id: nid("rule"),
    name: `${rule.name} copy`,
    status: "draft",
    lastExecution: null,
    nextExecution: "Not scheduled — preview only",
    conditions: rule.conditions.map((row) => ({ ...row, id: nid("c") })),
    actions: rule.actions.map((row) => ({ ...row, id: nid("a") })),
    routes: rule.routes.map((row) => ({ ...row })),
  };
}

export function moveItem<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

export type SimHit = {
  ready: boolean;
  reason: string;
};

export function simulateRule(rule: AutomationRule, sim: AutomationSim): SimHit {
  if (rule.status !== "active") {
    return { ready: false, reason: `Rule is ${rule.status} — simulation only.` };
  }
  if (rule.trigger === "manual") {
    return { ready: false, reason: "Manual rule — would wait for a later trigger." };
  }
  const readings: Record<TriggerKind, number> = {
    fee_balance: Number(sim.feeBalance),
    market_cap: Number(sim.marketCap),
    volume: Number(sim.volume),
    holders: Number(sim.holders),
    liquidity: Number(sim.liquidity),
    time: 1,
    milestone: Number(sim.marketCap),
    manual: 0,
  };
  const hits = rule.conditions.map((condition) => {
    const left = readings[condition.metric] ?? 0;
    const right = Number(String(condition.value).replace(/[^\d.]/g, ""));
    if (condition.metric === "time") return true;
    if (!Number.isFinite(right)) return false;
    if (condition.op === "gte") return left >= right;
    if (condition.op === "lte") return left <= right;
    if (condition.op === "gt") return left > right;
    if (condition.op === "lt") return left < right;
    return left === right;
  });
  const ready = rule.conditions.length === 0 ? false : rule.join === "and" ? hits.every(Boolean) : hits.some(Boolean);
  return {
    ready,
    reason: ready ? "Threshold reached in this preview." : "Conditions are not met in this preview.",
  };
}

export function simulatePayout(rule: AutomationRule, feeBalance: number) {
  return rule.routes.map((row) => ({
    ...row,
    label: FEE_DESTINATIONS[row.destination].label,
    usd: (feeBalance * row.bps) / 10_000,
  }));
}

export function lockedRouteBps(destination: FeeDestinationId) {
  return destination === "orbitx" ? ORBITX_PROTOCOL.allocationBps : undefined;
}

export function isTriggerKind(value: unknown): value is TriggerKind {
  return TRIGGER_KINDS.includes(value as TriggerKind);
}

export function isActionKind(value: unknown): value is ActionKind {
  return ACTION_KINDS.includes(value as ActionKind);
}

export function isRuleStatus(value: unknown): value is RuleStatus {
  return RULE_STATUSES.includes(value as RuleStatus);
}

export function isFeeDestinationId(value: unknown): value is FeeDestinationId {
  return FEE_DESTINATION_IDS.includes(value as FeeDestinationId);
}
