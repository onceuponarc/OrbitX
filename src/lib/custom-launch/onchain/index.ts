import type { PrintableChain } from "@onceupon/config/solana";
import type { CustomLaunchAdapter } from "@/lib/custom-launch/onchain/types";
import { evmAdapter } from "@/lib/custom-launch/onchain/evm";
import { solanaAdapter } from "@/lib/custom-launch/onchain/solana";

export function customLaunchAdapter(chain: PrintableChain): CustomLaunchAdapter {
  if (chain === "solana") return solanaAdapter();
  return evmAdapter(chain);
}

export { evmAdapter } from "@/lib/custom-launch/onchain/evm";
export { solanaAdapter } from "@/lib/custom-launch/onchain/solana";
export { assertAllowedAction, assertFeeSplits, assertTradingFeeBps, protocolDestinationForChain } from "@/lib/custom-launch/onchain/validate";
export { enabledExecuteActions, mapRuleAction } from "@/lib/custom-launch/onchain/actions";
export type { CustomLaunchAdapter, ChainCapability, DeployResult, ExecuteResult, AdapterContext } from "@/lib/custom-launch/onchain/types";
