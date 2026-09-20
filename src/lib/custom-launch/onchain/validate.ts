import { ORBITX_PROTOCOL } from "../protocol.ts";
import { MAX_TRADING_FEE_BPS, type FeeDestinationId } from "../fees.ts";
import { assertUsableRevenueWallet, chainFeeConfig, type ChainKey } from "../../fees/chains.ts";

export const EXECUTE_ACTIONS = [
  "buyback",
  "burn",
  "buyback_burn",
  "add_liquidity",
  "charity",
  "treasury",
  "community",
  "creator_claim",
  "holders",
  "flywheel",
  "claim_fees",
] as const;

export type ExecuteAction = (typeof EXECUTE_ACTIONS)[number];

const BLOCKED_ACTIONS = new Set(["remove_liquidity", "withdraw_liquidity", "drain_pool"]);

export type LaunchSplit = { dest: FeeDestinationId; bps: number; destination?: string };

export function assertTradingFeeBps(bps: number) {
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_TRADING_FEE_BPS) {
    throw new Error(`Trading fee must be an integer 0–${MAX_TRADING_FEE_BPS / 100}%.`);
  }
}

export function assertFeeSplits(splits: LaunchSplit[]) {
  const total = splits.reduce((sum, row) => sum + row.bps, 0);
  if (total !== 10_000) throw new Error(`Fee allocations must equal 100%. Got ${total / 100}%.`);
  const protocol = splits.find((row) => row.dest === "orbitx");
  if (!protocol || protocol.bps !== ORBITX_PROTOCOL.allocationBps) {
    throw new Error("OrbitX protocol share is locked at 25% of the trading fee.");
  }
}

export function assertAllowedAction(action: string): asserts action is ExecuteAction {
  if (BLOCKED_ACTIONS.has(action) || (action.includes("remove") && action.includes("liquidity"))) {
    throw new Error("Remove liquidity is not a Custom Launch action.");
  }
  if (!(EXECUTE_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`Unsupported Custom Launch action: ${action}`);
  }
}

export function protocolDestinationForChain(chain: "solana" | "arc" | "robinhood") {
  if (chain === "solana") return ORBITX_PROTOCOL.destination;
  const key: ChainKey = chain === "robinhood" ? "rh" : "arc";
  const cfg = chainFeeConfig(key);
  return assertUsableRevenueWallet(key, cfg.revenueWallet);
}

export function assertCreatorNotStrategyDest(action: ExecuteAction, dest: string, creator: string) {
  if (action === "creator_claim") return;
  if (dest.toLowerCase() === creator.toLowerCase()) {
    throw new Error("Strategy funds cannot be redirected to the creator wallet.");
  }
}
