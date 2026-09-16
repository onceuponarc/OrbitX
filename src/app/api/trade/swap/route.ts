import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getJupiterQuote } from "@/lib/solana/jupiter";
import { getMintInfo } from "@/lib/solana/mint-info";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import { sendSignedTx, waitForTx, explorerFromSig } from "@/lib/solana/partial-tx";
import { solanaConnection } from "@/lib/solana/connection";
import { SOLANA } from "@onceupon/config/solana";
import { buildAtomicSwapTx, verifyFeeCollected } from "@/lib/solana/atomic-swap";
import {
  ORBITX_REVENUE_PUBKEY,
  SOL_TX_HEADROOM_LAMPORTS,
  USDC_MINT,
  WSOL_MINT,
  splitFee,
  toRaw,
  toUi,
} from "@/lib/solana/orbitx-fee";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const SLIPPAGE_BPS = 100;

function resolveQuoteMint(asset: string | null | undefined) {
  return asset === "usdc" ? SOLANA.usdcMint : WSOL_MINT;
}

/**
 * Swap endpoint. The OrbitX fee is recomputed here from scratch — no fee figure
 * from the client is trusted — and it is placed in the SAME transaction as the
 * swap, so fee and trade share a fate. After confirmation the fee transfer is
 * verified against the landed transaction's own balance deltas before this route
 * reports a fee as collected.
 */
export async function POST(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });

    const body = (await request.json()) as {
      tokenMint?: string;
      quoteAsset?: "sol" | "usdc";
      side?: "buy" | "sell";
      amount?: number;
    };
    const tokenMint = (body.tokenMint ?? "").trim();
    const side = body.side === "sell" ? "sell" : "buy";
    const uiAmount = Number(body.amount);
    if (!tokenMint) return NextResponse.json({ error: "Missing token." }, { status: 400 });
    if (!Number.isFinite(uiAmount) || uiAmount <= 0) {
      return NextResponse.json({ error: "Enter an amount above zero." }, { status: 400 });
    }

    const quoteMint = resolveQuoteMint(body.quoteAsset);
    if (quoteMint !== WSOL_MINT && quoteMint !== USDC_MINT) {
      return NextResponse.json({ error: "Unsupported quote asset." }, { status: 400 });
    }
    const inputMint = side === "buy" ? quoteMint : tokenMint;
    const outputMint = side === "buy" ? tokenMint : quoteMint;

    const [inputInfo, outputInfo, quoteInfo] = await Promise.all([
      getMintInfo(inputMint),
      getMintInfo(outputMint),
      getMintInfo(quoteMint),
    ]);
    const grossInRaw = toRaw(uiAmount, inputInfo.decimals);

    const payer = await deskSolanaKey(user.id);

    // Re-derive the quote and the fee server-side rather than accepting either
    // from the client — a tampered payload could understate the fee or misstate
    // price impact and min-received.
    let quote;
    let fee;
    if (side === "buy") {
      fee = splitFee(grossInRaw, quoteMint, "buy");
      if (fee.netRaw <= 0n) {
        return NextResponse.json({ error: "Amount too small after the OrbitX fee." }, { status: 400 });
      }
      quote = await getJupiterQuote({
        inputMint,
        outputMint,
        amountRaw: fee.netRaw.toString(),
        slippageBps: SLIPPAGE_BPS,
      });
    } else {
      quote = await getJupiterQuote({
        inputMint,
        outputMint,
        amountRaw: grossInRaw.toString(),
        slippageBps: SLIPPAGE_BPS,
      });
      fee = splitFee(BigInt(quote.otherAmountThreshold), quoteMint, "sell");
    }

    // Balance must cover the whole debit including the fee, not just the swap leg.
    if (side === "buy" && quoteMint === WSOL_MINT) {
      const balance = BigInt(await solanaConnection().getBalance(payer.publicKey));
      if (balance < fee.grossRaw + SOL_TX_HEADROOM_LAMPORTS) {
        return NextResponse.json(
          { error: "Not enough SOL in your desk wallet for this trade, the OrbitX fee, and network fees." },
          { status: 400 },
        );
      }
    } else {
      const balance = BigInt(await solanaConnection().getBalance(payer.publicKey));
      if (balance < SOL_TX_HEADROOM_LAMPORTS) {
        return NextResponse.json(
          { error: "Not enough SOL in your desk wallet to cover network fees." },
          { status: 400 },
        );
      }
    }

    const { transaction } = await buildAtomicSwapTx({
      quote,
      payer: payer.publicKey,
      fee,
      feeDecimals: quoteInfo.decimals,
    });
    transaction.sign([payer]);

    const signature = await sendSignedTx(
      Buffer.from(transaction.serialize()).toString("base64"),
    );
    // Throws if the transaction landed with an error, so a reverted swap is never
    // reported as a successful trade.
    await waitForTx(signature);

    const verified = await verifyFeeCollected({
      signature,
      feeMint: fee.feeMint,
      feeRaw: fee.feeRaw,
      revenueWallet: ORBITX_REVENUE_PUBKEY,
    });

    const grossOutRaw = BigInt(quote.outAmount);
    return NextResponse.json({
      signature,
      explorer: explorerFromSig(signature),
      side,
      feeMint: fee.feeMint,
      feeBps: fee.feeBps,
      orbitxFeeUi: toUi(fee.feeRaw, quoteInfo.decimals),
      // Reported from the confirmed transaction, not from intent. Null means the
      // transfer could not be read back, not that it definitely failed — the fee
      // and swap are in one transaction, so a landed trade contains the fee.
      orbitxFeeVerified: verified.collected,
      orbitxFeeObservedUi:
        verified.observedRaw === null ? null : toUi(verified.observedRaw, quoteInfo.decimals),
      outAmountUi: toUi(
        side === "sell" ? grossOutRaw - fee.feeRaw : grossOutRaw,
        outputInfo.decimals,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trade failed." },
      { status: 400 },
    );
  }
}
