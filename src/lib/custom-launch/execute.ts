import "server-only";

import { customLaunchAdapter, enabledExecuteActions } from "@/lib/custom-launch/onchain";
import { assertAllowedAction, protocolDestinationForChain, type ExecuteAction } from "@/lib/custom-launch/onchain/validate";
import { splitArray } from "@/lib/custom-launch/onchain/splits";
import {
  insertDistributions,
  insertExecution,
  loadLaunchById,
  updateExecution,
} from "@/lib/custom-launch/persist";
import { verifyHolderRecipients, type HolderRecipient } from "@/lib/custom-launch/holders";
import { syncLaunchVaults } from "@/lib/custom-launch/sync";

function randomExecId() {
  return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function executeCustomLaunchAction(input: {
  userId: string;
  launchId: string;
  action: string;
  amount: string;
  recipients?: HolderRecipient[];
  minOut?: string;
  ruleId?: string;
}) {
  assertAllowedAction(input.action);
  const launch = await loadLaunchById(input.launchId);
  if (!launch) throw new Error("Custom Launch not found.");
  if (launch.author_user_id !== input.userId) throw new Error("Only the creator can execute this strategy.");
  if (launch.status !== "live") throw new Error("Custom Launch is not live.");
  if (launch.paused) throw new Error("Custom Launch is paused.");
  if (!launch.token_address) throw new Error("Token is not deployed.");
  const draft = launch.config;
  const allowed = enabledExecuteActions(draft.mode, draft);
  if (!allowed.includes(input.action as ExecuteAction) && input.action !== "claim_fees") {
    throw new Error(`${input.action} is not enabled for this launch.`);
  }
  const amount = BigInt(input.amount || "0");
  if (amount <= 0n && input.action !== "claim_fees" && input.action !== "holders") {
    throw new Error("Execution amount must be greater than zero.");
  }
  let recipients = input.recipients;
  if (input.action === "holders") {
    recipients = await verifyHolderRecipients({
      chain: launch.chain,
      token: launch.token_address,
      creator: launch.creator_address || "",
      proposed: input.recipients ?? [],
    });
  }
  const execId = randomExecId();
  const row = await insertExecution({
    launchId: launch.id,
    action: input.action,
    execId,
    amount: amount.toString(),
    ruleId: input.ruleId,
  });
  const adapter = customLaunchAdapter(launch.chain);
  let txHash: string | undefined;
  let explorer: string | null | undefined;
  try {
    const result = await adapter.executeStrategy(input.action as ExecuteAction, amount, {
      userId: input.userId,
      creatorAddress: launch.creator_address || "",
      protocolAddress: protocolDestinationForChain(launch.chain),
      launchId: launch.id,
      execId,
      factoryAddress: launch.factory_address ?? undefined,
      hubAddress: launch.hub_address ?? undefined,
      tokenAddress: launch.token_address ?? undefined,
      poolAddress: launch.pool_address ?? undefined,
      routerAddress: launch.router_address ?? undefined,
      quoteAddress: launch.quote_address ?? undefined,
      charity: launch.charity_address ?? undefined,
      treasury: launch.treasury_address ?? undefined,
      community: launch.community_address ?? undefined,
      minOut: input.minOut ? BigInt(input.minOut) : 0n,
      recipients: recipients?.map((row) => ({ address: row.address, amount: BigInt(row.amount) })),
      tradeFeeBps: launch.trade_fee_bps,
      splitBps: splitArray(draft),
    });
    txHash = result.txHash;
    explorer = result.explorer;
    if (result.status !== "completed" || !result.txHash) {
      throw new Error("Strategy execution did not confirm on-chain.");
    }
    const confirmed = await adapter.getExecutionStatus(result.txHash);
    if (confirmed === "failed") throw new Error("Strategy transaction failed on-chain.");
    if (confirmed === "pending") {
      await updateExecution(row.id, {
        status: "pending",
        tx_hash: result.txHash,
        explorer_url: result.explorer,
      });
      return { ...result, status: "pending", executionId: row.id, execId };
    }
    await updateExecution(row.id, {
      status: "completed",
      tx_hash: result.txHash,
      explorer_url: result.explorer,
      received: result.received ?? null,
      confirmed_at: new Date().toISOString(),
      error: null,
    });
    if (input.action === "holders" && recipients?.length) {
      await insertDistributions({
        launchId: launch.id,
        executionId: row.id,
        recipients,
        txHash: result.txHash,
      });
    }
    await syncLaunchVaults(launch).catch(() => undefined);
    return { ...result, executionId: row.id, execId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strategy execution failed.";
    await updateExecution(row.id, { status: "failed", error: message, tx_hash: txHash ?? null, explorer_url: explorer ?? null });
    throw error;
  }
}
