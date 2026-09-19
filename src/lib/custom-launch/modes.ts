export const LAUNCH_STRATEGY_IDS = [
  "standard",
  "flywheel",
  "bagwork",
  "holders",
  "charity",
  "buyback",
  "burn",
  "liquidity",
  "treasury",
  "community",
  "custom",
] as const;

export type LaunchStrategyId = (typeof LAUNCH_STRATEGY_IDS)[number];

export type StrategyRole = "frame" | "module";

export type StrategyLane = {
  id: string;
  label: string;
  bps: number;
};

export type MockCharity = {
  id: string;
  name: string;
  wallet: string;
};

export type StrategyIntent = {
  allocationBps: number;
  threshold: string;
  maxAmount: string;
  frequency: string;
  wallet: string;
  charityId: string;
};

export type CustomLaunchModeState = {
  primary: LaunchStrategyId;
  modules: LaunchStrategyId[];
  inspected: LaunchStrategyId;
  notes: string;
  intents: Partial<Record<LaunchStrategyId, StrategyIntent>>;
};

export type LaunchStrategy = {
  id: LaunchStrategyId;
  name: string;
  short: string;
  designedFor: string;
  role: StrategyRole;
  advanced?: boolean;
  accent: string;
  icon: string;
  does: string;
  configures: string[];
  automations: string[];
  laterSteps: string[];
  destinations: StrategyLane[];
};

export const MOCK_CHARITIES: MockCharity[] = [
  { id: "water", name: "Clean Water Desk", wallet: "0xCHARITY0000000000000000000000000001" },
  { id: "habitat", name: "Habitat Desk", wallet: "0xCHARITY0000000000000000000000000002" },
  { id: "custom", name: "Custom charity wallet", wallet: "" },
];

export const DEFAULT_STRATEGY_INTENT: StrategyIntent = {
  allocationBps: 2000,
  threshold: "1.0",
  maxAmount: "10",
  frequency: "weekly",
  wallet: "",
  charityId: "water",
};

export const LAUNCH_STRATEGIES: LaunchStrategy[] = [
  {
    id: "standard",
    name: "Standard Custom",
    short: "Full desk control without a preset economic thesis.",
    designedFor: "General-purpose custom prints",
    role: "frame",
    accent: "gold",
    icon: "sliders",
    does: "Gives the creator full control over token, economics, liquidity, and later automation without locking the print into a named fee thesis.",
    configures: ["Token identity", "Trading economics", "Primary and secondary markets", "Optional modules later"],
    automations: ["None until a module is added"],
    laterSteps: ["Any destination module can be stacked on top"],
    destinations: [{ id: "desk", label: "Creator desk", bps: 10_000 }],
  },
  {
    id: "flywheel",
    name: "Flywheel",
    short: "Route trading fees through a looping ecosystem stack.",
    designedFor: "Tokens that recycle flow",
    role: "frame",
    accent: "arc",
    icon: "flywheel",
    does: "Treats every trade as fuel. Fees are claimed, then split across buybacks, liquidity, treasury, burns, and holders.",
    configures: ["Destination mix", "Claim cadence", "Later trigger thresholds"],
    automations: ["Auto-claim", "Fee router", "Looping allocations"],
    laterSteps: ["Fine-tune each flywheel lane", "Add or remove destinations"],
    destinations: [
      { id: "buyback", label: "Buybacks", bps: 2500 },
      { id: "liquidity", label: "Liquidity", bps: 2500 },
      { id: "treasury", label: "Treasury", bps: 2000 },
      { id: "burn", label: "Burns", bps: 1500 },
      { id: "holders", label: "Holder rewards", bps: 1500 },
    ],
  },
  {
    id: "bagwork",
    name: "Bag Work",
    short: "Creator and community fee mechanics with recurring desk actions.",
    designedFor: "Advanced creator desks",
    role: "frame",
    accent: "heat",
    icon: "bag",
    does: "Centers the print on configurable creator/community take and a schedule of recurring actions. Feels like a working bag, not a one-shot mint.",
    configures: ["Creator share", "Community share", "Recurring action cadence"],
    automations: ["Fee split", "Scheduled desk actions"],
    laterSteps: ["Action recipes", "Claim windows"],
    destinations: [
      { id: "creator", label: "Creator fees", bps: 5000 },
      { id: "community", label: "Community", bps: 3000 },
      { id: "actions", label: "Recurring actions", bps: 2000 },
    ],
  },
  {
    id: "holders",
    name: "Holder Rewards",
    short: "Send a configured slice of trading fees to eligible holders.",
    designedFor: "Holder-first economies",
    role: "module",
    accent: "buy",
    icon: "holders",
    does: "Trading fees are claimed, then routed into a holder distribution. Eligibility and claim rules come in a later step.",
    configures: ["Holder allocation", "Eligibility", "Claim cadence"],
    automations: ["Auto-claim", "Holder distribution"],
    laterSteps: ["Snapshot rules", "Claim UI"],
    destinations: [{ id: "holders", label: "Holder distribution", bps: 10_000 }],
  },
  {
    id: "charity",
    name: "Charity",
    short: "Route a percentage of generated fees to a designated charity.",
    designedFor: "Cause-linked prints",
    role: "module",
    accent: "teal",
    icon: "charity",
    does: "A configured share of claimed fees is marked for a charity or charity wallet. Selection and thresholds stay mock in this phase.",
    configures: ["Charity selection", "Charity wallet", "Percentage allocation", "Distribution threshold"],
    automations: ["Auto-claim", "Charity route"],
    laterSteps: ["Verified charity directory", "On-chain payout"],
    destinations: [
      { id: "desk", label: "Creator desk", bps: 8000 },
      { id: "charity", label: "Charity", bps: 2000 },
    ],
  },
  {
    id: "buyback",
    name: "Buyback",
    short: "Use generated fees to fund automated buybacks.",
    designedFor: "Supply-support loops",
    role: "module",
    accent: "gold",
    icon: "buyback",
    does: "Claimed fees queue into a buyback program. Allocation, trigger, cap, and frequency are UI concepts only right now.",
    configures: ["Buyback allocation", "Trigger threshold", "Maximum execution amount", "Frequency"],
    automations: ["Auto-claim", "Buyback queue"],
    laterSteps: ["Execution venue", "Slippage guard"],
    destinations: [{ id: "buyback", label: "Buyback queue", bps: 10_000 }],
  },
  {
    id: "burn",
    name: "Burn",
    short: "Destroy tokens from the selected fee strategy.",
    designedFor: "Deflationary desks",
    role: "module",
    accent: "burgundy",
    icon: "burn",
    does: "A configured slice of the strategy is marked for burn after claim. Preview only — nothing is destroyed from this UI.",
    configures: ["Burn allocation", "Trigger threshold", "Estimated behavior"],
    automations: ["Auto-claim", "Burn mark"],
    laterSteps: ["Burn address / instruction", "Reporting tape"],
    destinations: [{ id: "burn", label: "Burn", bps: 10_000 }],
  },
  {
    id: "liquidity",
    name: "Liquidity",
    short: "Automatically allocate fees back into market depth.",
    designedFor: "Depth-first prints",
    role: "module",
    accent: "cyan",
    icon: "liquidity",
    does: "Claimed fees are reserved for the primary pool, with optional secondary destinations. No pool is created here.",
    configures: ["Liquidity allocation", "Trigger threshold", "Primary pool destination", "Secondary pool options"],
    automations: ["Auto-claim", "LP allocation"],
    laterSteps: ["Pool pairing", "Lock policy"],
    destinations: [
      { id: "primary-pool", label: "Primary pool", bps: 7000 },
      { id: "secondary-pool", label: "Secondary pool", bps: 3000 },
    ],
  },
  {
    id: "treasury",
    name: "Treasury",
    short: "Park configured fees in a creator or community treasury.",
    designedFor: "Balance-sheet prints",
    role: "module",
    accent: "metal",
    icon: "treasury",
    does: "Fees route into a treasury wallet after claim. Wallet and threshold stay mock until a later phase.",
    configures: ["Treasury wallet", "Allocation", "Trigger threshold"],
    automations: ["Auto-claim", "Treasury deposit"],
    laterSteps: ["Signer set", "Spend policy"],
    destinations: [{ id: "treasury", label: "Treasury", bps: 10_000 }],
  },
  {
    id: "community",
    name: "Community",
    short: "Point the fee router at a community-controlled ecosystem.",
    designedFor: "Shared treasuries",
    role: "module",
    accent: "lime",
    icon: "community",
    does: "A community wallet or treasury receives the configured share, with optional automated distributions to holders.",
    configures: ["Community wallet / treasury", "Holder/community allocation", "Optional automated distributions"],
    automations: ["Auto-claim", "Community route", "Optional distributions"],
    laterSteps: ["Council / multisig", "Distribution recipe"],
    destinations: [
      { id: "community", label: "Community treasury", bps: 6000 },
      { id: "holders", label: "Holder / community", bps: 4000 },
    ],
  },
  {
    id: "custom",
    name: "Custom Strategy",
    short: "Build a programmable fee and automation graph.",
    designedFor: "Rule-system desks",
    role: "frame",
    advanced: true,
    accent: "advanced",
    icon: "custom",
    does: "The most advanced OrbitX mode. Compose your own fee router from named rules instead of a single thesis. Modules become explicit lanes in the graph.",
    configures: ["Rule set", "Lane weights", "Triggers", "Stacked modules"],
    automations: ["Programmable claim", "Rule evaluation", "Any destination module"],
    laterSteps: ["Visual rule builder", "On-chain strategy binding"],
    destinations: [
      { id: "rule-a", label: "Rule A", bps: 2500 },
      { id: "rule-b", label: "Rule B", bps: 2500 },
      { id: "rule-c", label: "Rule C", bps: 2500 },
      { id: "unassigned", label: "Unassigned", bps: 2500 },
    ],
  },
];

export function isLaunchStrategyId(value: unknown): value is LaunchStrategyId {
  return typeof value === "string" && (LAUNCH_STRATEGY_IDS as readonly string[]).includes(value);
}

export function findStrategy(id: LaunchStrategyId | null | undefined) {
  return LAUNCH_STRATEGIES.find((strategy) => strategy.id === id);
}

export function defaultStrategyIntent(id: LaunchStrategyId): StrategyIntent {
  const strategy = findStrategy(id);
  const first = strategy?.destinations[0];
  return {
    ...DEFAULT_STRATEGY_INTENT,
    allocationBps: first && strategy && strategy.destinations.length === 1 ? first.bps : 2000,
  };
}

export function createLaunchModeState(): CustomLaunchModeState {
  return {
    primary: "standard",
    modules: [],
    inspected: "standard",
    notes: "",
    intents: {},
  };
}

export function selectedStrategyIds(mode: CustomLaunchModeState): LaunchStrategyId[] {
  return [mode.primary, ...mode.modules.filter((id) => id !== mode.primary)];
}

export function launchModeTitle(mode: CustomLaunchModeState | null | undefined) {
  if (!mode?.primary) return "Not selected";
  const primary = findStrategy(mode.primary)?.name ?? mode.primary;
  if (!mode.modules.length) return primary;
  return `${primary} + ${mode.modules.length}`;
}

export function launchModeSummary(mode: CustomLaunchModeState) {
  const names = selectedStrategyIds(mode).map((id) => findStrategy(id)?.name ?? id);
  return names.join(" + ");
}

function renormalize(lanes: StrategyLane[]): StrategyLane[] {
  const total = lanes.reduce((sum, lane) => sum + lane.bps, 0);
  if (!total) return lanes;
  const scaled = lanes.map((lane) => ({
    ...lane,
    bps: Math.round((lane.bps / total) * 10_000),
  }));
  const drift = 10_000 - scaled.reduce((sum, lane) => sum + lane.bps, 0);
  if (scaled[0]) scaled[0] = { ...scaled[0], bps: scaled[0].bps + drift };
  return scaled.filter((lane) => lane.bps > 0);
}

export function composeStrategyPreview(mode: CustomLaunchModeState): StrategyLane[] {
  const ids = selectedStrategyIds(mode);
  const merged = new Map<string, StrategyLane>();

  for (const id of ids) {
    const strategy = findStrategy(id);
    if (!strategy) continue;
    const intent = mode.intents[id];
    const lanes = strategy.destinations.map((lane) => {
      if (intent && strategy.destinations.length === 1) {
        return { ...lane, bps: intent.allocationBps };
      }
      if (intent && lane.id === id) {
        return { ...lane, bps: intent.allocationBps };
      }
      return { ...lane };
    });
    for (const lane of lanes) {
      const existing = merged.get(lane.id);
      merged.set(lane.id, existing ? { ...lane, bps: existing.bps + lane.bps } : lane);
    }
  }

  let lanes = [...merged.values()];
  if (lanes.length > 1) {
    lanes = lanes.filter((lane) => lane.id !== "desk" && lane.id !== "unassigned");
  }
  return renormalize(lanes);
}

export function setPrimaryStrategy(
  mode: CustomLaunchModeState,
  id: LaunchStrategyId,
): CustomLaunchModeState {
  return {
    ...mode,
    primary: id,
    inspected: id,
    modules: mode.modules.filter((module) => module !== id),
  };
}

export function toggleStrategyModule(
  mode: CustomLaunchModeState,
  id: LaunchStrategyId,
): CustomLaunchModeState {
  if (mode.primary === id) return { ...mode, inspected: id };
  const exists = mode.modules.includes(id);
  return {
    ...mode,
    inspected: id,
    modules: exists ? mode.modules.filter((module) => module !== id) : [...mode.modules, id],
  };
}

export function inspectStrategy(mode: CustomLaunchModeState, id: LaunchStrategyId): CustomLaunchModeState {
  return { ...mode, inspected: id };
}
