import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getJupiterQuote, getJupiterSwapTx, WSOL_MINT } from "@/lib/solana/jupiter";
import { getMintInfo } from "@/lib/solana/mint-info";
import { SOLANA } from "@onceupon/config/solana";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function quoteMint(asset: unknown) {
  return asset === "usdc" ? SOLANA.usdcMint : WSOL_MINT;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tokenMint?: string;
      quoteAsset?: "sol" | "usdc";
      side?: "buy" | "sell";
      amount?: number;
      userPublicKey?: string;
    };
    const tokenMint = (body.tokenMint ?? "").trim();
    const userPublicKey = (body.userPublicKey ?? "").trim();
    const side = body.side === "sell" ? "sell" : "buy";
    const amount = Number(body.amount);
    if (!tokenMint || !userPublicKey) return NextResponse.json({ error: "Token and wallet are required." }, { status: 400 });
    try {
      new PublicKey(tokenMint);
      new PublicKey(userPublicKey);
    } catch {
      return NextResponse.json({ error: "Invalid Solana token or wallet address." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Enter an amount above zero." }, { status: 400 });

    const quote = quoteMint(body.quoteAsset);
    const inputMint = side === "buy" ? quote : tokenMint;
    const outputMint = side === "buy" ? tokenMint : quote;
    const inputInfo = await getMintInfo(inputMint);
    const amountRaw = BigInt(Math.round(amount * 10 ** inputInfo.decimals)).toString();
    const route = await getJupiterQuote({ inputMint, outputMint, amountRaw, slippageBps: 100 });
    const swapTransaction = await getJupiterSwapTx(route, userPublicKey);
    const outputInfo = await getMintInfo(outputMint);
    return NextResponse.json({
      swapTransaction,
      outAmountUi: Number(route.outAmount) / 10 ** outputInfo.decimals,
      inputMint,
      outputMint,
      slippageBps: route.slippageBps,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Jupiter could not build this wallet swap." }, { status: 400 });
  }
}
