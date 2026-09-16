import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { chainFeeConfig } from "@/lib/fees/chains";
import { ARC_FEE_ASSET_DECIMALS } from "@/lib/arc/orbitx-fee";

/**
 * Records OrbitX revenue events for Arc into public.orbitx_revenue_events
 * (migration 0011, generalized to multi-chain by 0012).
 *
 * Never throws. This runs after a confirmed trade, so a bookkeeping failure must
 * not surface to the trader as a failed trade — it fails loudly to the log and
 * leaves the row absent rather than corrupting the trade response.
 */

function serviceOrNull() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

export async function recordArcRevenueEvent(input: {
  kind: "trade" | "launch";
  /** Hash of the fee transfer. Null when collection did not complete. */
  feeTxHash: string | null;
  /** Hash of the confirmed trade the fee belongs to. */
  tradeTxHash: string;
  payer: string;
  /** Quote-asset address the fee is denominated in (Arc USDC ERC-20). */
  feeMint: string;
  feeAmountRaw: bigint;
  feeBps: number;
  side?: "buy" | "sell";
  tokenAddress?: string | null;
  userId?: string | null;
  /** True only when a confirmed balance delta proved the transfer landed. */
  verified: boolean;
  collectionError?: string | null;
}) {
  const service = serviceOrNull();
  if (!service) {
    console.error(
      `[orbitx-revenue][arc] no service client; unrecorded ${input.kind} fee ` +
        `${input.feeAmountRaw} for trade ${input.tradeTxHash}`,
    );
    return;
  }

  const cfg = chainFeeConfig("arc");
  const row = {
    chain: "arc",
    protocol: "par",
    kind: input.kind,
    signature: input.feeTxHash,
    trade_signature: input.tradeTxHash,
    user_id: input.userId ?? null,
    payer: input.payer,
    fee_mint: input.feeMint,
    // Numeric column: pass the exact integer as a string, never a JS number.
    fee_amount_raw: input.feeAmountRaw.toString(),
    fee_bps: input.feeBps,
    fee_asset_decimals: ARC_FEE_ASSET_DECIMALS,
    // Arc quotes in USDC, so raw units at 6dp already are the USD figure.
    fee_usd: Number(input.feeAmountRaw) / 10 ** ARC_FEE_ASSET_DECIMALS,
    side: input.side ?? null,
    token_mint: input.tokenAddress ?? null,
    verified: input.verified,
    collection_error: input.collectionError ?? null,
  };

  const result = await service.from("orbitx_revenue_events").insert(row);
  if (!result.error) return;

  const message = result.error.message ?? "";
  // The per-chain unique indexes make a retry a no-op rather than double-counting.
  if (/duplicate|unique/i.test(message)) return;

  if (/orbitx_revenue_events/i.test(message) && /does not exist|schema/i.test(message)) {
    console.error(
      `[orbitx-revenue][arc] migrations 0011/0012 are not applied; unrecorded fee ` +
        `${input.feeAmountRaw} for trade ${input.tradeTxHash}. Revenue wallet ${cfg.revenueWallet}.`,
    );
    return;
  }

  console.error(
    `[orbitx-revenue][arc] insert failed for trade ${input.tradeTxHash}: ${message}`,
  );
}
