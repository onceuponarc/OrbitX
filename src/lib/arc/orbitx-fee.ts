import "server-only";

import { formatUnits, getAddress } from "viem";
import { erc20Abi } from "@/lib/arc/abi";
import { publicArc, traderWallet } from "@/lib/arc/client";
import type { ArcNetworkFile } from "@/lib/arc/env";
import { applyBps, splitByBps } from "@/lib/fees/bps";
import {
  assertUsableRevenueWallet,
  chainFeeConfig,
  tradeFeesEnabled,
} from "@/lib/fees/chains";

/**
 * OrbitX revenue fees on Arc.
 *
 * ATOMICITY — read this before changing anything here.
 *
 * On Solana the fee rides inside the swap transaction, so fee and trade share
 * one fate. Arc cannot do that today: `curve.buy(quoteIn, minBaseOut)` and
 * `curve.sell(baseIn, minQuoteOut)` take no fee-recipient argument, and the
 * `feeRecipient` on `createStory` belongs to the creator-fee waterfall
 * (authorBps / protocolBps / pieceBps), which OrbitX revenue must stay out of.
 * An EOA also cannot bundle an ERC-20 transfer with a contract call in one
 * transaction. True atomicity therefore needs an OrbitX router contract on Arc
 * that does transferFrom(payer, revenue, fee) + curve.buy(net) in a single call.
 *
 * Until that contract exists, the fee is a SECOND transaction, and the ordering
 * is chosen so the irrecoverable direction cannot happen:
 *
 *   trade confirms first  ->  then the fee transfer is sent.
 *
 * Worst case is a successful trade whose fee did not land: OrbitX is owed money
 * and the row is recorded unverified, which is reconcilable. The reverse — a
 * user charged a fee on a trade that never happened — is not reconcilable, and
 * this ordering makes it impossible.
 */

export const ARC_FEE_ASSET_DECIMALS = 6;

/** Strict EIP-55 validation on top of the shared prohibitions. */
export function arcRevenueWallet(): `0x${string}` {
  const cfg = chainFeeConfig("arc");
  const candidate = assertUsableRevenueWallet("arc", cfg.revenueWallet);
  let checksummed: string;
  try {
    checksummed = getAddress(candidate);
  } catch {
    throw new Error(`Arc revenue wallet failed EIP-55 checksum validation: ${candidate}`);
  }
  if (checksummed !== candidate) {
    throw new Error(
      `Arc revenue wallet checksum does not match its bytes (expected ${checksummed}).`,
    );
  }
  return checksummed as `0x${string}`;
}

export type ArcFeeQuote = {
  chain: "arc";
  enabled: boolean;
  feeBps: number;
  /** Raw USDC (6dp) that OrbitX will take. */
  feeRaw: bigint;
  feeUi: number;
  /** Buy only: what actually goes into the curve after the fee. */
  netInRaw: bigint;
  grossInRaw: bigint;
  side: "buy" | "sell";
};

/**
 * buy  — fee comes off the USDC input, so the curve only ever sees the net.
 * sell — fee comes out of USDC proceeds, computed on the GUARANTEED minimum
 *        received, never the optimistic quote. Basing it on the optimistic
 *        figure lets ordinary slippage leave the wallet short. Slippage upside
 *        stays with the trader.
 */
export function arcTradeFee(opts: {
  side: "buy" | "sell";
  /** buy: gross USDC in (6dp). sell: ignored. */
  grossInRaw: bigint;
  /** sell: guaranteed minimum USDC out (6dp). buy: ignored. */
  minQuoteOutRaw: bigint;
}): ArcFeeQuote {
  const cfg = chainFeeConfig("arc");
  const enabled = tradeFeesEnabled("arc");
  const bps = enabled ? cfg.tradeFeeBps : 0;

  if (opts.side === "buy") {
    if (opts.grossInRaw <= 0n) throw new Error("Enter an amount above zero.");
    if (!enabled) {
      return {
        chain: "arc",
        enabled,
        feeBps: 0,
        feeRaw: 0n,
        feeUi: 0,
        netInRaw: opts.grossInRaw,
        grossInRaw: opts.grossInRaw,
        side: "buy",
      };
    }
    const split = splitByBps(opts.grossInRaw, bps);
    return {
      chain: "arc",
      enabled,
      feeBps: bps,
      feeRaw: split.feeRaw,
      feeUi: Number(formatUnits(split.feeRaw, ARC_FEE_ASSET_DECIMALS)),
      netInRaw: split.netRaw,
      grossInRaw: split.grossRaw,
      side: "buy",
    };
  }

  if (opts.minQuoteOutRaw < 0n) throw new Error("Minimum received cannot be negative.");
  const feeRaw = enabled ? applyBps(opts.minQuoteOutRaw, bps) : 0n;
  return {
    chain: "arc",
    enabled,
    feeBps: bps,
    feeRaw,
    feeUi: Number(formatUnits(feeRaw, ARC_FEE_ASSET_DECIMALS)),
    netInRaw: opts.grossInRaw,
    grossInRaw: opts.grossInRaw,
    side: "sell",
  };
}

export type ArcFeeCollection = {
  feeRaw: bigint;
  feeUi: number;
  feeTxHash: `0x${string}` | null;
  /** True only when the transfer was read back off a confirmed receipt. */
  verified: boolean;
  revenueWallet: `0x${string}` | null;
  /** Populated when collection did not complete; the trade still stands. */
  error: string | null;
};

/**
 * Send the fee and prove it landed.
 *
 * Called only after the trade receipt is confirmed successful. Never throws:
 * the trade has already happened, and a fee-collection failure must not be
 * reported to the trader as a failed trade. It fails LOUDLY into the return
 * value and the log instead, so the row is stored unverified and can be chased.
 */
export async function collectArcTradeFee(opts: {
  net: ArcNetworkFile;
  feeRaw: bigint;
  /** Hash of the already-confirmed trade, for log correlation. */
  tradeTxHash: `0x${string}`;
}): Promise<ArcFeeCollection> {
  const { net, feeRaw, tradeTxHash } = opts;
  const zero: ArcFeeCollection = {
    feeRaw: 0n,
    feeUi: 0,
    feeTxHash: null,
    verified: false,
    revenueWallet: null,
    error: null,
  };

  if (!tradeFeesEnabled("arc")) return zero;
  // Dust: the fee floored to nothing. Report zero rather than sending a
  // zero-value transfer and calling it revenue.
  if (feeRaw <= 0n) return zero;

  let revenue: `0x${string}`;
  try {
    revenue = arcRevenueWallet();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arc revenue wallet unusable.";
    console.error(`[orbitx-fee][arc] refusing to collect for trade ${tradeTxHash}: ${message}`);
    return { ...zero, error: message };
  }

  const feeUi = Number(formatUnits(feeRaw, ARC_FEE_ASSET_DECIMALS));

  try {
    const pub = publicArc(net);
    const wallet = traderWallet(net);

    const before = (await pub.readContract({
      address: net.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [revenue],
    })) as bigint;

    const feeTxHash = await wallet.writeContract({
      address: net.usdc,
      abi: erc20Abi,
      functionName: "transfer",
      args: [revenue, feeRaw],
    });

    const receipt = await pub.waitForTransactionReceipt({ hash: feeTxHash });
    if (receipt.status !== "success") {
      const message = `Arc fee transfer reverted (${feeTxHash}).`;
      console.error(`[orbitx-fee][arc] ${message} trade=${tradeTxHash}`);
      return { feeRaw, feeUi, feeTxHash, verified: false, revenueWallet: revenue, error: message };
    }

    // Evidence, not intent: the revenue wallet's own balance must have moved by
    // exactly the fee before this is reported as collected.
    const after = (await pub.readContract({
      address: net.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [revenue],
    })) as bigint;

    const delta = after - before;
    if (delta !== feeRaw) {
      const message = `Arc fee transfer confirmed but balance moved ${delta} instead of ${feeRaw}.`;
      console.error(`[orbitx-fee][arc] ${message} tx=${feeTxHash} trade=${tradeTxHash}`);
      return { feeRaw, feeUi, feeTxHash, verified: false, revenueWallet: revenue, error: message };
    }

    return { feeRaw, feeUi, feeTxHash, verified: true, revenueWallet: revenue, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arc fee transfer failed.";
    console.error(
      `[orbitx-fee][arc] uncollected fee ${feeRaw} for confirmed trade ${tradeTxHash}: ${message}`,
    );
    return { feeRaw, feeUi, feeTxHash: null, verified: false, revenueWallet: null, error: message };
  }
}
