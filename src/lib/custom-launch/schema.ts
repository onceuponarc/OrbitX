import type { PrintableChain } from "@onceupon/config/solana";
import { automationComplete, createAutomationConfig, type AutomationConfig } from "@/lib/custom-launch/automation";
import { createFeeConfig, feeConfigComplete, type FeeConfig } from "@/lib/custom-launch/fees";
import {
  createMarketsConfig,
  primaryMarketComplete,
  secondaryMarketsComplete,
  type MarketsConfig,
} from "@/lib/custom-launch/markets";
import { createLaunchModeState, type CustomLaunchModeState } from "@/lib/custom-launch/modes";
import { createSupplyPlan, supplyPlanBalanced, type SupplyPlan } from "@/lib/custom-launch/supply";
import { createTokenConfig, tokenConfigComplete, type TokenConfig } from "@/lib/custom-launch/token";

export const CUSTOM_LAUNCH_STEPS = [
  { id: "mode", label: "Launch Mode", short: "Mode" },
  { id: "token", label: "Token", short: "Token" },
  { id: "economics", label: "Trading Economics", short: "Economics" },
  { id: "primary", label: "Primary Market", short: "Primary" },
  { id: "secondary", label: "Secondary Markets", short: "Secondary" },
  { id: "automation", label: "Automation", short: "Auto" },
  { id: "review", label: "Review", short: "Review" },
  { id: "deploy", label: "Deploy", short: "Deploy" },
] as const;

export type CustomLaunchStepId = (typeof CUSTOM_LAUNCH_STEPS)[number]["id"];

export type QuotePreference = "native" | "usdc";

export type {
  CustomLaunchModeState,
  LaunchStrategyId,
  StrategyIntent,
} from "@/lib/custom-launch/modes";
export {
  composeStrategyPreview,
  createLaunchModeState,
  findStrategy,
  inspectStrategy,
  LAUNCH_STRATEGIES,
  launchModeSummary,
  launchModeTitle,
  selectedStrategyIds,
  setPrimaryStrategy,
  toggleStrategyModule,
} from "@/lib/custom-launch/modes";

export type CustomChainMeta = {
  id: PrintableChain;
  label: string;
  longLabel: string;
  short: string;
  venue: string;
  quote: string;
  native: string;
  decimals: number;
};

export const CUSTOM_CHAIN_META: Record<PrintableChain, CustomChainMeta> = {
  solana: {
    id: "solana",
    label: "Solana",
    longLabel: "Solana",
    short: "SOL",
    venue: "pump.fun · Jupiter",
    quote: "SOL",
    native: "SOL",
    decimals: 9,
  },
  arc: {
    id: "arc",
    label: "Arc",
    longLabel: "Arc",
    short: "ARC",
    venue: "Argus · Uniswap v4",
    quote: "USDC",
    native: "USDC",
    decimals: 18,
  },
  robinhood: {
    id: "robinhood",
    label: "RH",
    longLabel: "Robinhood Chain",
    short: "RH",
    venue: "Pons v2 · Uniswap v4",
    quote: "ETH",
    native: "ETH",
    decimals: 18,
  },
};

export type CustomLaunchDraft = {
  version: 4;
  chain: PrintableChain;
  mode: CustomLaunchModeState;
  token: TokenConfig;
  supply: SupplyPlan;
  fees: FeeConfig;
  economics: {
    quote: QuotePreference;
    maxWalletBps: number;
    maxTxBps: number;
    transferRestricted: boolean;
  };
  markets: MarketsConfig;
  automation: AutomationConfig;
  reviewedAt: string | null;
};

export function createCustomLaunchDraft(chain: PrintableChain): CustomLaunchDraft {
  const meta = CUSTOM_CHAIN_META[chain];
  return {
    version: 4,
    chain,
    mode: createLaunchModeState(),
    token: createTokenConfig(meta.decimals),
    supply: createSupplyPlan(),
    fees: createFeeConfig(createLaunchModeState()),
    economics: {
      quote: chain === "arc" ? "usdc" : "native",
      maxWalletBps: 200,
      maxTxBps: 100,
      transferRestricted: false,
    },
    markets: createMarketsConfig(),
    automation: createAutomationConfig(),
    reviewedAt: null,
  };
}

export type StepStatus = "complete" | "incomplete" | "ready" | "blocked";

export function stepStatus(draft: CustomLaunchDraft, id: CustomLaunchStepId): StepStatus {
  switch (id) {
    case "mode":
      return draft.mode.primary ? "complete" : "incomplete";
    case "token":
      return tokenConfigComplete(draft.token) && supplyPlanBalanced(draft.supply) ? "complete" : "incomplete";
    case "economics":
      return feeConfigComplete(draft.mode, draft.fees) ? "complete" : "incomplete";
    case "primary":
      return primaryMarketComplete(draft.markets, draft.token.supply) ? "complete" : "incomplete";
    case "secondary":
      return secondaryMarketsComplete(draft.markets) ? "complete" : "incomplete";
    case "automation":
      return automationComplete(draft.automation) ? "complete" : "incomplete";
    case "review":
      return requiredStepsComplete(draft) ? "complete" : "incomplete";
    case "deploy":
      if (!requiredStepsComplete(draft)) return "blocked";
      return draft.reviewedAt ? "ready" : "incomplete";
  }
}

export const REQUIRED_STEP_IDS: CustomLaunchStepId[] = [
  "mode",
  "token",
  "economics",
  "primary",
  "secondary",
  "automation",
];

export function requiredStepsComplete(draft: CustomLaunchDraft) {
  return REQUIRED_STEP_IDS.every((id) => stepStatus(draft, id) === "complete");
}

export function configuredCount(draft: CustomLaunchDraft) {
  return CUSTOM_LAUNCH_STEPS.filter((step) => {
    const status = stepStatus(draft, step.id);
    return status === "complete" || status === "ready";
  }).length;
}

export function incompleteSteps(draft: CustomLaunchDraft) {
  return CUSTOM_LAUNCH_STEPS.filter((step) => {
    const status = stepStatus(draft, step.id);
    return status === "incomplete" || status === "blocked";
  });
}

export function stepIndex(id: CustomLaunchStepId) {
  return CUSTOM_LAUNCH_STEPS.findIndex((step) => step.id === id);
}

export function adjacentStep(id: CustomLaunchStepId, delta: -1 | 1): CustomLaunchStepId | null {
  const next = stepIndex(id) + delta;
  return CUSTOM_LAUNCH_STEPS[next]?.id ?? null;
}

export function formatBps(bps: number) {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export function formatHours(hours: number) {
  if (hours % 24 === 0) return `${hours / 24}d`;
  return `${hours}h`;
}
