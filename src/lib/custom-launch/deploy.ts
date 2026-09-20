import "server-only";

import { customLaunchAdapter } from "@/lib/custom-launch/onchain";
import { protocolDestinationForChain } from "@/lib/custom-launch/onchain/validate";
import { splitArray } from "@/lib/custom-launch/onchain/splits";
import { insertPreparingLaunch, markLaunchDeploying, markLaunchFailed, markLaunchLive } from "@/lib/custom-launch/persist";
import { solanaVaultAddresses } from "@/lib/custom-launch/onchain/solana";
import { launchIsReady } from "@/lib/custom-launch/readiness";
import { assertFeeSplits, assertTradingFeeBps } from "@/lib/custom-launch/onchain/validate";
import { resolvedFeeAllocations } from "@/lib/custom-launch/fees";
import { MOCK_CHARITIES } from "@/lib/custom-launch/modes";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { ARC_USDC } from "@/lib/arc/argus";
import { WSOL_MINT } from "@/lib/solana/jupiter";

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function isEvmAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function lockedDest(draft: CustomLaunchDraft, kind: "charity" | "treasury" | "community", creator: string) {
  const intent = draft.mode.intents[kind];
  if (kind === "charity") {
    const selected = MOCK_CHARITIES.find((row) => row.id === (intent?.charityId || "custom"));
    const raw = (intent?.wallet || selected?.wallet || "").trim();
    if (raw && !raw.startsWith("0xCHARITY") && validAddr(draft.chain, raw) && raw !== creator) return raw;
    return "";
  }
  const raw = (intent?.wallet || "").trim();
  if (raw && validAddr(draft.chain, raw)) return raw;
  return "";
}

function validAddr(chain: CustomLaunchDraft["chain"], value: string) {
  return chain === "solana" ? isSolanaAddress(value) : isEvmAddress(value);
}

export function quoteAddressForDraft(draft: CustomLaunchDraft) {
  if (draft.chain === "arc") return ARC_USDC;
  if (draft.chain === "solana") return draft.markets.primary.quote === "usdc" ? SOLANA_USDC : WSOL_MINT;
  return "";
}

export async function deployCustomLaunch(input: { userId: string; draft: CustomLaunchDraft; creatorAddress: string }) {
  const { draft, userId, creatorAddress } = input;
  if (!launchIsReady(draft)) throw new Error("Custom Launch configuration is incomplete.");
  assertTradingFeeBps(draft.fees.tradingFeeBps);
  assertFeeSplits(resolvedFeeAllocations(draft.mode, draft.fees).map((row) => ({ dest: row.id, bps: row.bps })));
  const adapter = customLaunchAdapter(draft.chain);
  const caps = adapter.capabilities();
  if (!caps.tokenCreate) throw new Error(caps.note);
  const charity = lockedDest(draft, "charity", creatorAddress);
  const treasury = lockedDest(draft, "treasury", creatorAddress);
  const community = lockedDest(draft, "community", creatorAddress);
  const protocol = protocolDestinationForChain(draft.chain);
  const quoteAddress = quoteAddressForDraft(draft) || undefined;
  const row = await insertPreparingLaunch({
    userId,
    draft,
    creatorAddress,
    charity: charity || undefined,
    treasury: treasury || undefined,
    community: community || undefined,
    quoteAddress,
  });
  await markLaunchDeploying(row.id);
  try {
    const result = await adapter.createToken(draft, {
      userId,
      creatorAddress,
      protocolAddress: protocol,
      launchId: row.id,
      execId: `deploy-${row.id}`,
      charity: charity || creatorAddress,
      treasury: treasury || creatorAddress,
      community: community || creatorAddress,
      quoteAddress,
      tradeFeeBps: draft.fees.tradingFeeBps,
      splitBps: splitArray(draft),
    });
    if (!result.txHash || !result.tokenAddress) {
      throw new Error("Deployment did not return a confirmed token address and transaction.");
    }
    const vaults = draft.chain === "solana" ? solanaVaultAddresses(row.id) : undefined;
    await markLaunchLive(row.id, result, {
      vaults,
      poolStatus: result.poolAddress ? "live" : "unsupported",
    });
    return { ...row, ...result, slug: row.id ? row.slug : row.slug, launchId: row.id, capabilities: caps };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Custom Launch deployment failed.";
    await markLaunchFailed(row.id, message);
    throw error;
  }
}
