import { ruleError, type AutomationConfig } from "./automation.ts";
import {
  feeAllocatedBps,
  feeAllocationsExact,
  MAX_TRADING_FEE_BPS,
  resolvedFeeAllocations,
} from "./fees.ts";
import { PRIMARY_QUOTES, primaryMarketComplete, secondaryMarketsComplete } from "./markets.ts";
import type { CustomLaunchDraft, CustomLaunchStepId } from "./schema.ts";
import { supplyPlanBalanced } from "./supply.ts";
import { tokenConfigComplete, validateTokenConfig } from "./token.ts";

export type ReadinessCheckId =
  | "token_info"
  | "token_supply"
  | "supply_alloc"
  | "trading_fee"
  | "fee_alloc"
  | "primary_selected"
  | "primary_pair"
  | "liquidity"
  | "secondary"
  | "automation_rules"
  | "automation_destinations"
  | "duplicate_rules"
  | "invalid_conditions"
  | "required_fields";

export type ReadinessCheck = {
  id: ReadinessCheckId;
  label: string;
  pass: boolean;
  detail: string;
  step: CustomLaunchStepId;
};

export function evaluateReadiness(draft: CustomLaunchDraft): ReadinessCheck[] {
  const tokenErrors = validateTokenConfig(draft.token);
  const fees = resolvedFeeAllocations(draft.mode, draft.fees);
  const feeExact = feeAllocationsExact(fees);
  const primaryOk = primaryMarketComplete(draft.markets, draft.token.supply);
  const pairOk = PRIMARY_QUOTES.includes(draft.markets.primary.quote);
  const secondaryOk = secondaryMarketsComplete(draft.markets);
  const invalidRules = draft.automation.rules.filter((rule) => ruleError(rule));
  const destMissing = draft.automation.rules.some(
    (rule) =>
      rule.actions.some((action) => ["distribute_fees", "execute_flywheel", "reward_holders"].includes(action.kind)) &&
      rule.routes.every((row) => row.bps <= 0),
  );
  const names = draft.automation.rules.map((rule) => rule.name.trim().toLowerCase()).filter(Boolean);
  const duplicateNames = names.some((name, index) => names.indexOf(name) !== index);

  return [
    {
      id: "token_info",
      label: "Token information complete",
      pass: tokenConfigComplete(draft.token),
      detail: tokenErrors.name || tokenErrors.symbol || tokenErrors.imageUrl || "Name, symbol, and image are set.",
      step: "token",
    },
    {
      id: "token_supply",
      label: "Token supply valid",
      pass: !tokenErrors.supply && !tokenErrors.decimals,
      detail: tokenErrors.supply || tokenErrors.decimals || "Supply and decimals pass the local checks.",
      step: "token",
    },
    {
      id: "supply_alloc",
      label: "Supply allocations equal 100%",
      pass: supplyPlanBalanced(draft.supply),
      detail: supplyPlanBalanced(draft.supply) ? "Supply buckets sum to 100%." : "Supply buckets must sum to 100%.",
      step: "token",
    },
    {
      id: "trading_fee",
      label: "Trading fee within 0–5%",
      pass: draft.fees.tradingFeeBps >= 0 && draft.fees.tradingFeeBps <= MAX_TRADING_FEE_BPS,
      detail:
        draft.fees.tradingFeeBps >= 0 && draft.fees.tradingFeeBps <= MAX_TRADING_FEE_BPS
          ? "Fee is inside the 0–5% desk range."
          : "Trading fee must be 0–5%.",
      step: "economics",
    },
    {
      id: "fee_alloc",
      label: "Fee allocations equal 100%",
      pass: feeExact,
      detail: feeExact ? "Fee destinations sum to 100%." : `Allocated ${feeAllocatedBps(fees) / 100}%. Must equal 100%.`,
      step: "economics",
    },
    {
      id: "primary_selected",
      label: "Primary market selected",
      pass: Boolean(draft.markets.primary.quote) && draft.markets.access.primaryEnabled,
      detail:
        draft.markets.access.primaryEnabled && draft.markets.primary.quote
          ? "Primary market is selected."
          : "Select a primary market to continue.",
      step: "primary",
    },
    {
      id: "primary_pair",
      label: "Primary pair is SOL or USDC",
      pass: pairOk,
      detail: pairOk ? `Primary pair is ${draft.markets.primary.quote.toUpperCase()}.` : "Primary pair must be SOL or USDC.",
      step: "primary",
    },
    {
      id: "liquidity",
      label: "Bonding curve configured",
      pass: primaryOk,
      detail: primaryOk
        ? "Custom bonding curve opens at launch. Neither OrbitX nor the creator deposits LP."
        : "Select a primary market to continue.",
      step: "primary",
    },
    {
      id: "secondary",
      label: "Secondary markets configured",
      pass: secondaryOk,
      detail: secondaryOk
        ? draft.markets.secondary.length
          ? `${draft.markets.secondary.length} secondary book${draft.markets.secondary.length === 1 ? "" : "s"} valid.`
          : "Optional — primary only is allowed."
        : "Complete this market or remove it.",
      step: "secondary",
    },
    {
      id: "automation_rules",
      label: "Automation rules valid",
      pass: invalidRules.length === 0,
      detail:
        invalidRules.length === 0
          ? draft.automation.rules.length
            ? `${draft.automation.rules.length} rule${draft.automation.rules.length === 1 ? "" : "s"} valid.`
            : "No automation rules — optional."
          : invalidRules[0] ? ruleError(invalidRules[0]) ?? "Fix invalid rules." : "Fix invalid rules.",
      step: "automation",
    },
    {
      id: "automation_destinations",
      label: "Automation destinations configured",
      pass: !destMissing,
      detail: destMissing ? "A distribute rule needs destinations." : "Destinations are set or unused.",
      step: "automation",
    },
    {
      id: "duplicate_rules",
      label: "No duplicate rules",
      pass: !duplicateNames,
      detail: duplicateNames ? "Two rules share the same name." : "Rule names are unique.",
      step: "automation",
    },
    {
      id: "invalid_conditions",
      label: "No invalid conditions",
      pass: invalidRules.length === 0,
      detail: invalidRules.length === 0 ? "Conditions pass the local checks." : "A condition is incomplete or invalid.",
      step: "automation",
    },
    {
      id: "required_fields",
      label: "Required fields completed",
      pass:
        tokenConfigComplete(draft.token) &&
        supplyPlanBalanced(draft.supply) &&
        feeExact &&
        primaryOk &&
        secondaryOk &&
        invalidRules.length === 0,
      detail:
        tokenConfigComplete(draft.token) &&
        supplyPlanBalanced(draft.supply) &&
        feeExact &&
        primaryOk &&
        secondaryOk &&
        invalidRules.length === 0
          ? "Required desks are complete."
          : "Open the failing row and finish the draft.",
      step: "review",
    },
  ];
}

export function launchIsReady(draft: CustomLaunchDraft) {
  return evaluateReadiness(draft).every((check) => check.pass);
}

export function failingChecks(draft: CustomLaunchDraft) {
  return evaluateReadiness(draft).filter((check) => !check.pass);
}

export function creatorFeeBps(draft: CustomLaunchDraft) {
  return resolvedFeeAllocations(draft.mode, draft.fees).find((row) => row.id === "creator")?.bps ?? 0;
}

export function automationCounts(config: AutomationConfig) {
  return {
    total: config.rules.length,
    active: config.rules.filter((rule) => rule.status === "active").length,
    milestones: config.milestones.length,
  };
}
