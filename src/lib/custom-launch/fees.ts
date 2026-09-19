import {
  selectedStrategyIds,
  type CustomLaunchModeState,
  type LaunchStrategyId,
} from "./modes.ts";
import { ORBITX_PROTOCOL } from "./protocol.ts";

export const FEE_DESTINATION_IDS = [
  "orbitx",
  "creator",
  "holders",
  "liquidity",
  "buyback",
  "burn",
  "charity",
  "treasury",
  "community",
  "custom",
] as const;

export type FeeDestinationId = (typeof FEE_DESTINATION_IDS)[number];

export type FeeAllocation = {
  id: FeeDestinationId;
  label: string;
  bps: number;
  locked: boolean;
};

export type FeeConfig = {
  tradingFeeBps: number;
  shares: Partial<Record<FeeDestinationId, number>>;
};

export const MAX_TRADING_FEE_BPS = 500;

export const FEE_DESTINATIONS: Record<FeeDestinationId, { label: string; hint: string }> = {
  orbitx: { label: "OrbitX", hint: "Locked protocol allocation" },
  creator: { label: "Creator", hint: "Creator desk take" },
  holders: { label: "Holders", hint: "Eligible holder distribution" },
  liquidity: { label: "Liquidity", hint: "Depth / LP reserve" },
  buyback: { label: "Buyback", hint: "Buyback queue" },
  burn: { label: "Burn", hint: "Burn mark" },
  charity: { label: "Charity", hint: "Designated charity route" },
  treasury: { label: "Treasury", hint: "Creator / community treasury" },
  community: { label: "Community", hint: "Community-controlled ecosystem" },
  custom: { label: "Custom", hint: "Other destination" },
};

const MODE_DESTINATIONS: Record<LaunchStrategyId, FeeDestinationId[]> = {
  standard: ["orbitx", "creator", "holders", "liquidity", "treasury"],
  flywheel: ["orbitx", "buyback", "liquidity", "burn", "treasury", "holders"],
  bagwork: ["orbitx", "creator", "community", "holders"],
  holders: ["orbitx", "creator", "holders", "liquidity"],
  charity: ["orbitx", "creator", "charity", "holders", "liquidity"],
  buyback: ["orbitx", "creator", "buyback", "liquidity"],
  burn: ["orbitx", "creator", "burn", "liquidity"],
  liquidity: ["orbitx", "creator", "liquidity"],
  treasury: ["orbitx", "creator", "treasury"],
  community: ["orbitx", "creator", "community", "holders"],
  custom: [...FEE_DESTINATION_IDS],
};

const PRESET_SPLITS: Partial<Record<LaunchStrategyId, Partial<Record<FeeDestinationId, number>>>> = {
  standard: { creator: 2500, holders: 2000, liquidity: 1500, treasury: 1500 },
  flywheel: { buyback: 2000, liquidity: 1500, burn: 1500, treasury: 1500, holders: 1000 },
  bagwork: { creator: 2500, community: 3000, holders: 2000 },
  holders: { creator: 2500, holders: 3500, liquidity: 1500 },
  charity: { creator: 2500, charity: 2000, holders: 1500, liquidity: 1500 },
  buyback: { creator: 2500, buyback: 3500, liquidity: 1500 },
  burn: { creator: 2500, burn: 3500, liquidity: 1500 },
  liquidity: { creator: 3500, liquidity: 4000 },
  treasury: { creator: 3500, treasury: 4000 },
  community: { creator: 2500, community: 3000, holders: 2000 },
  custom: {
    creator: 1500,
    holders: 1000,
    liquidity: 1000,
    buyback: 800,
    burn: 700,
    charity: 500,
    treasury: 800,
    community: 700,
    custom: 500,
  },
};

export function visibleFeeDestinations(mode: CustomLaunchModeState): FeeDestinationId[] {
  const ids = new Set<FeeDestinationId>(["orbitx"]);
  for (const strategy of selectedStrategyIds(mode)) {
    for (const id of MODE_DESTINATIONS[strategy]) ids.add(id);
  }
  return FEE_DESTINATION_IDS.filter((id) => ids.has(id));
}

export function defaultFeeShares(mode: CustomLaunchModeState): Partial<Record<FeeDestinationId, number>> {
  const dests = visibleFeeDestinations(mode).filter((id) => id !== "orbitx");
  const remainder = 10_000 - ORBITX_PROTOCOL.allocationBps;
  const preset = PRESET_SPLITS[mode.primary] ?? {};
  const shares: Partial<Record<FeeDestinationId, number>> = {};
  let used = 0;
  dests.forEach((id, index) => {
    if (index === dests.length - 1) {
      shares[id] = Math.max(0, remainder - used);
      return;
    }
    const bps = preset[id] ?? Math.floor(remainder / dests.length);
    shares[id] = bps;
    used += bps;
  });
  return shares;
}

export function createFeeConfig(mode: CustomLaunchModeState): FeeConfig {
  return {
    tradingFeeBps: 300,
    shares: defaultFeeShares(mode),
  };
}

export function clampTradingFeeBps(bps: number) {
  if (!Number.isFinite(bps)) return 0;
  return Math.max(0, Math.min(MAX_TRADING_FEE_BPS, Math.round(bps)));
}

export function resolvedFeeAllocations(mode: CustomLaunchModeState, fees: FeeConfig): FeeAllocation[] {
  const dests = visibleFeeDestinations(mode);
  const defaults = defaultFeeShares(mode);
  return dests.map((id) => ({
    id,
    label: FEE_DESTINATIONS[id].label,
    locked: id === "orbitx",
    bps: id === "orbitx" ? ORBITX_PROTOCOL.allocationBps : (fees.shares[id] ?? defaults[id] ?? 0),
  }));
}

export function feeAllocatedBps(allocations: FeeAllocation[]) {
  return allocations.reduce((sum, row) => sum + row.bps, 0);
}

export function feeRemainingBps(allocations: FeeAllocation[]) {
  return 10_000 - feeAllocatedBps(allocations);
}

export function feeAllocationsExact(allocations: FeeAllocation[]) {
  return feeAllocatedBps(allocations) === 10_000;
}

export function feeAllocationsOver(allocations: FeeAllocation[]) {
  return feeAllocatedBps(allocations) > 10_000;
}

export function feeConfigComplete(mode: CustomLaunchModeState, fees: FeeConfig) {
  const allocations = resolvedFeeAllocations(mode, fees);
  return (
    fees.tradingFeeBps >= 0 &&
    fees.tradingFeeBps <= MAX_TRADING_FEE_BPS &&
    feeAllocationsExact(allocations)
  );
}

export function exampleFeeOnVolume(volumeUsd: number, tradingFeeBps: number) {
  return (volumeUsd * tradingFeeBps) / 10_000;
}

export function exampleShareOfFees(feeUsd: number, allocationBps: number) {
  return (feeUsd * allocationBps) / 10_000;
}

export function formatUsdEstimate(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return `$${rounded.toLocaleString("en-US", { minimumFractionDigits: rounded % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
