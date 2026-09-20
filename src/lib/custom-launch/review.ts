import {
  ACTION_META,
  COMPARE_META,
  TRIGGER_META,
  formatActionLine,
  formatConditionValue,
  formatDestinationLine,
  formatTriggerLine,
  ruleError,
  type AutomationConfig,
  type AutomationRule,
} from "./automation.ts";
import { FEE_DESTINATIONS, resolvedFeeAllocations, type FeeAllocation } from "./fees.ts";
import {
  configuredMarketCount,
  formatEstimatePrice,
  formatEstimateUsd,
  pairLabel,
  primaryEstimate,
  quoteTicker,
} from "./markets.ts";
import { findStrategy, launchModeSummary, selectedStrategyIds } from "./modes.ts";
import { ORBITX_PROTOCOL } from "./protocol.ts";
import { automationCounts, creatorFeeBps, launchIsReady } from "./readiness.ts";
import {
  CUSTOM_CHAIN_META,
  formatBps,
  formatHours,
  type CustomLaunchDraft,
} from "./schema.ts";
import { formatSupply, type TokenConfig } from "./token.ts";

export type TimelineStatus = "Ready" | "Pending" | "Disabled" | "Requires configuration";

export type AutomationTimelineNode = {
  id: string;
  title: string;
  trigger: string;
  condition: string;
  action: string;
  destination: string;
  status: TimelineStatus;
};

export type TokenSocial = {
  label: string;
  url: string;
};

export function tokenSocials(token: TokenConfig): TokenSocial[] {
  const rows: TokenSocial[] = [];
  if (token.website.trim()) rows.push({ label: "Website", url: token.website.trim() });
  if (token.twitter.trim()) rows.push({ label: "X", url: token.twitter.trim() });
  if (token.telegram.trim()) rows.push({ label: "Telegram", url: token.telegram.trim() });
  if (token.discord.trim()) rows.push({ label: "Discord", url: token.discord.trim() });
  for (const link of token.extraLinks) {
    if (link.label.trim() && link.url.trim()) rows.push({ label: link.label.trim(), url: link.url.trim() });
  }
  return rows;
}

export function feeRoutingLine(allocations: FeeAllocation[]) {
  return allocations
    .filter((row) => row.bps > 0)
    .map((row) => `${row.label} ${formatBps(row.bps)}`)
    .join(" · ");
}

export function allocationDestination(id: FeeAllocation["id"]) {
  if (id === "orbitx") return ORBITX_PROTOCOL.destination;
  return `Configured ${FEE_DESTINATIONS[id].label} destination`;
}

export function formatMarketCapMark(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Milestone";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 ? 2 : 0)}M market cap`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(amount % 1_000 ? 1 : 0)}K market cap`;
  return `$${amount.toLocaleString("en-US")} market cap`;
}

function ruleTimelineStatus(rule: AutomationRule | undefined, configured: boolean): TimelineStatus {
  if (!configured) return "Requires configuration";
  if (!rule) return "Pending";
  if (ruleError(rule)) return "Requires configuration";
  if (rule.status === "paused") return "Disabled";
  if (rule.status === "active") return "Ready";
  return "Pending";
}

function matchRuleForMilestone(automation: AutomationConfig, marketCap: string, action: string) {
  return automation.rules.find((rule) => {
    const sameAction = rule.actions.some((item) => item.kind === action);
    const sameCap = rule.conditions.some((item) => item.metric === "market_cap" && item.value === marketCap);
    return sameAction && (rule.trigger === "milestone" || rule.trigger === "market_cap" || sameCap);
  });
}

export function automationTimeline(automation: AutomationConfig): AutomationTimelineNode[] {
  const launch: AutomationTimelineNode = {
    id: "launch",
    title: "Launch",
    trigger: "Launch",
    condition: "Configuration armed",
    action: "Print the local desk",
    destination: "Primary market",
    status: "Ready",
  };

  const used = new Set<string>();
  const milestones = [...automation.milestones]
    .sort((a, b) => Number(a.marketCap) - Number(b.marketCap))
    .map((row) => {
      const configured = Boolean(row.marketCap.trim()) && Boolean(row.action);
      const rule = matchRuleForMilestone(automation, row.marketCap, row.action);
      if (rule) used.add(rule.id);
      const cap = formatMarketCapMark(row.marketCap);
      return {
        id: row.id,
        title: cap,
        trigger: "Market cap",
        condition: `≥ ${cap}`,
        action: ACTION_META[row.action].label,
        destination: rule ? formatDestinationLine(rule) : "Configured action lane",
        status: ruleTimelineStatus(rule, configured),
      } satisfies AutomationTimelineNode;
    });

  const extraRules = automation.rules
    .filter((rule) => !used.has(rule.id))
    .map((rule) => {
      const first = rule.conditions[0];
      return {
        id: rule.id,
        title: rule.name.trim() || TRIGGER_META[rule.trigger].label,
        trigger: TRIGGER_META[rule.trigger].label,
        condition: first
          ? `${TRIGGER_META[first.metric].label} ${COMPARE_META[first.op]} ${formatConditionValue(first)}`
          : formatTriggerLine(rule),
        action: formatActionLine(rule),
        destination: formatDestinationLine(rule),
        status: ruleTimelineStatus(rule, true),
      } satisfies AutomationTimelineNode;
    });

  return [launch, ...milestones, ...extraRules];
}

export function automationDeskLines(automation: AutomationConfig) {
  const counts = automationCounts(automation);
  const triggers = [...new Set(automation.rules.map((rule) => TRIGGER_META[rule.trigger].label))];
  const actions = [...new Set(automation.rules.flatMap((rule) => rule.actions.map((item) => ACTION_META[item.kind].label)))];
  const destinations = [
    ...new Set(
      automation.rules.flatMap((rule) =>
        rule.routes.filter((row) => row.bps > 0).map((row) => FEE_DESTINATIONS[row.destination].label),
      ),
    ),
  ];
  const cooldowns = automation.rules
    .map((rule) => rule.cooldown.trim())
    .filter(Boolean)
    .map((hours) => (/^\d+$/.test(hours) ? formatHours(Number(hours)) : hours));

  return {
    ...counts,
    triggers: triggers.length ? triggers.join(" · ") : "None armed",
    actions: actions.length ? actions.join(" · ") : "None armed",
    destinations: destinations.length ? destinations.join(" · ") : "None armed",
    cooldowns: cooldowns.length ? [...new Set(cooldowns)].join(" · ") : "None",
    enabled: counts.active,
  };
}

export function reviewSnapshot(draft: CustomLaunchDraft) {
  const meta = CUSTOM_CHAIN_META[draft.chain];
  const allocations = resolvedFeeAllocations(draft.mode, draft.fees);
  const estimate = primaryEstimate(draft.markets, draft.token.supply);
  const ready = launchIsReady(draft);
  const modules = selectedStrategyIds(draft.mode)
    .slice(1)
    .map((id) => findStrategy(id)?.name ?? id);
  const automation = automationDeskLines(draft.automation);
  const symbol = draft.token.symbol.trim().toUpperCase();

  return {
    ready,
    statusLabel: ready ? "READY" : "CONFIGURATION REQUIRED",
    chain: {
      id: meta.id,
      label: meta.label,
      longLabel: meta.longLabel,
      short: meta.short,
      venue: meta.venue,
      status: ready ? "Live desk" : "Draft",
    },
    launchType: {
      kind: "Custom Launch",
      strategy: launchModeSummary(draft.mode),
      modules: modules.length ? modules.join(" + ") : "None",
    },
    token: {
      name: draft.token.name.trim() || "—",
      symbol: symbol ? `$${symbol}` : "—",
      ticker: symbol,
      supply: formatSupply(draft.token.supply),
      decimals: String(draft.token.decimals),
      description: draft.token.description.trim() || "—",
      imageUrl: draft.token.imageUrl,
      bannerUrl: draft.token.bannerUrl,
      socials: tokenSocials(draft.token),
    },
    market: {
      pair: pairLabel(draft.token.symbol, draft.markets.primary.quote),
      quote: quoteTicker(draft.markets.primary.quote),
      liquidity: formatEstimateUsd(estimate.liquidityUsd),
      tokenAllocation: formatSupply(draft.markets.primary.pool.tokenAllocation),
      price: formatEstimatePrice(estimate.initialPrice),
      marketCap: formatEstimateUsd(estimate.marketCapUsd),
      secondaries: draft.markets.secondary.length
        ? draft.markets.secondary
            .map((row) => pairLabel(draft.token.symbol, row.quote, row.customTicker))
            .join(" · ")
        : "Primary only",
      secondaryCount: draft.markets.secondary.length,
      marketCount: configuredMarketCount(draft.markets, draft.token.supply),
    },
    economics: {
      tradingFee: formatBps(draft.fees.tradingFeeBps),
      tradingFeeBps: draft.fees.tradingFeeBps,
      allocations,
      routing: feeRoutingLine(allocations),
      orbitx: formatBps(ORBITX_PROTOCOL.allocationBps),
      creator: formatBps(creatorFeeBps(draft)),
    },
    automation,
    preview: {
      strategy: launchModeSummary(draft.mode),
      pair: pairLabel(draft.token.symbol, draft.markets.primary.quote),
      liquidity: formatEstimateUsd(estimate.liquidityUsd),
      fee: formatBps(draft.fees.tradingFeeBps),
      rules: `${automation.total} rule${automation.total === 1 ? "" : "s"}`,
      markets: `${configuredMarketCount(draft.markets, draft.token.supply)}`,
    },
  };
}
