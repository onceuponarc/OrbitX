import { ACTION_TO_ID } from "./abi.ts";
import { assertAllowedAction, type ExecuteAction } from "./validate.ts";
import type { ActionKind, AutomationRule } from "../automation.ts";
import { selectedStrategyIds, type CustomLaunchModeState } from "../modes.ts";
import { resolvedFeeAllocations, type FeeConfig } from "../fees.ts";

const KIND_TO_ACTION: Record<string, ExecuteAction | "skip"> = {
  claim_fees: "claim_fees",
  distribute_fees: "claim_fees",
  buyback: "buyback",
  burn: "burn",
  buyback_burn: "buyback_burn",
  add_liquidity: "add_liquidity",
  send_treasury: "treasury",
  send_creator: "creator_claim",
  send_charity: "charity",
  reward_holders: "holders",
  execute_flywheel: "flywheel",
  trigger_rule: "skip",
  custom: "skip",
};

export function mapRuleAction(kind: ActionKind | string): ExecuteAction | null {
  if (kind.includes("remove") && kind.includes("liquidity")) {
    throw new Error("Remove liquidity is not a Custom Launch action.");
  }
  const mapped = KIND_TO_ACTION[kind];
  if (!mapped || mapped === "skip") return null;
  assertAllowedAction(mapped);
  return mapped;
}

export function flywheelActionIds(draft: { automation: { rules: AutomationRule[] }; mode: CustomLaunchModeState }): number[] {
  const ids: number[] = [];
  for (const rule of draft.automation.rules) {
    if (rule.status !== "active") continue;
    if (!rule.actions.some((action) => action.kind === "execute_flywheel")) continue;
    for (const action of rule.actions) {
      const mapped = mapRuleAction(action.kind);
      if (!mapped || mapped === "flywheel" || mapped === "claim_fees") continue;
      ids.push(ACTION_TO_ID[mapped]);
    }
  }
  if (ids.length) return ids;
  const strategies = selectedStrategyIds(draft.mode);
  if (strategies.includes("flywheel") || strategies.includes("buyback")) ids.push(ACTION_TO_ID.buyback);
  if (strategies.includes("burn")) ids.push(ACTION_TO_ID.burn);
  if (strategies.includes("liquidity")) ids.push(ACTION_TO_ID.add_liquidity);
  if (strategies.includes("holders")) ids.push(ACTION_TO_ID.holders);
  return ids;
}

export function enabledExecuteActions(
  mode: CustomLaunchModeState,
  draft: { mode: CustomLaunchModeState; fees: FeeConfig },
): ExecuteAction[] {
  const strategies = new Set(selectedStrategyIds(mode));
  const splits = resolvedFeeAllocations(mode, draft.fees);
  const funded = new Set(splits.filter((row) => row.bps > 0).map((row) => row.id));
  const out: ExecuteAction[] = [];
  const add = (action: ExecuteAction, when: boolean) => {
    if (when && !out.includes(action)) out.push(action);
  };
  add("claim_fees", true);
  add("creator_claim", funded.has("creator"));
  add("buyback", strategies.has("buyback") || strategies.has("flywheel") || funded.has("buyback"));
  add("burn", strategies.has("burn") || funded.has("burn"));
  add("buyback_burn", out.includes("buyback") && out.includes("burn"));
  add("holders", strategies.has("holders") || funded.has("holders"));
  add("add_liquidity", strategies.has("liquidity") || funded.has("liquidity"));
  add("treasury", strategies.has("treasury") || funded.has("treasury"));
  add("charity", strategies.has("charity") || funded.has("charity"));
  add("community", strategies.has("community") || strategies.has("bagwork") || funded.has("community"));
  add("flywheel", strategies.has("flywheel"));
  return out;
}
