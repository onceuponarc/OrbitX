import { NextResponse } from "next/server";
import { getJupiterQuote } from "@/lib/solana/jupiter";
import { getMintInfo } from "@/lib/solana/mint-info";
import { SOLANA } from "@onceupon/config/solana";
import {
  ORBITX_TRADE_FEE_BPS,
  USDC_MINT,
  WSOL_MINT,
  splitFee,
  toRaw,
  toUi,
} from "@/lib/solana/orbitx-fee-math";

export const dynamic = "force-dynamic";

const SLIPPAGE_BPS = 100;

function resolveQuoteMint(asset: string | null) {
  return asset === "usdc" ? SOLANA.usdcMint : WSOL_MINT;
}

/**
 * Quote endpoint. Returns the full fee breakdown the swap endpoint will
 * independently recompute: gross in, OrbitX fee, net swapped, and the resulting
 * output. The fee is applied exactly once, on the quote-asset side of the trade.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tokenMint = url.searchParams.get("token");
    const quoteAsset = url.searchParams.get("quote");
    const side = url.searchParams.get("side") === "sell" ? "sell" : "buy";
    const uiAmount = Number(url.searchParams.get("amount") ?? "0");
    if (!tokenMint) return NextResponse.json({ error: "Missing token mint." }, { status: 400 });
    if (!Number.isFinite(uiAmount) || uiAmount <= 0) {
      return NextResponse.json({ error: "Enter an amount above zero." }, { status: 400 });
    }

    const quoteMint = resolveQuoteMint(quoteAsset);
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

    if (side === "buy") {
      // Fee comes off the input first; Jupiter only ever quotes the net.
      const fee = splitFee(grossInRaw, quoteMint, "buy");
      if (fee.netRaw <= 0n) {
        return NextResponse.json({ error: "Amount too small after the OrbitX fee." }, { status: 400 });
      }
      const quote = await getJupiterQuote({
        inputMint,
        outputMint,
        amountRaw: fee.netRaw.toString(),
        slippageBps: SLIPPAGE_BPS,
      });
      return NextResponse.json({
        side,
        inputMint,
        outputMint,
        feeMint: fee.feeMint,
        feeBps: fee.feeBps,
        grossInUi: toUi(fee.grossRaw, inputInfo.decimals),
        orbitxFeeUi: toUi(fee.feeRaw, quoteInfo.decimals),
        netSwapInUi: toUi(fee.netRaw, inputInfo.decimals),
        outAmountUi: toUi(BigInt(quote.outAmount), outputInfo.decimals),
        minReceivedUi: toUi(BigInt(quote.otherAmountThreshold), outputInfo.decimals),
        priceImpactPct: Number(quote.priceImpactPct),
        route: quote.routePlan?.map((r) => r.swapInfo.label).join(" + ") || "Jupiter",
        raw: quote,
      });
    }

    // Sell: the whole token amount is swapped, then the fee is taken from proceeds.
    const quote = await getJupiterQuote({
      inputMint,
      outputMint,
      amountRaw: grossInRaw.toString(),
      slippageBps: SLIPPAGE_BPS,
    });
    const minOutRaw = BigInt(quote.otherAmountThreshold);
    const fee = splitFee(minOutRaw, quoteMint, "sell");
    return NextResponse.json({
      side,
      inputMint,
      outputMint,
      feeMint: fee.feeMint,
      feeBps: fee.feeBps,
      grossInUi: toUi(grossInRaw, inputInfo.decimals),
      // Fee is charged on the guaranteed minimum, so the figure shown is the
      // figure collected even if the fill comes in better than quoted.
      orbitxFeeUi: toUi(fee.feeRaw, quoteInfo.decimals),
      grossOutUi: toUi(BigInt(quote.outAmount), outputInfo.decimals),
      outAmountUi: toUi(BigInt(quote.outAmount) - fee.feeRaw, outputInfo.decimals),
      minReceivedUi: toUi(fee.netRaw, outputInfo.decimals),
      priceImpactPct: Number(quote.priceImpactPct),
      route: quote.routePlan?.map((r) => r.swapInfo.label).join(" + ") || "Jupiter",
      raw: quote,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not get a quote." },
      { status: 400 },
    );
  }
}

export { ORBITX_TRADE_FEE_BPS };
