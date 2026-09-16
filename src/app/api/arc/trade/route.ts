import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { tradeArcV4 } from "@/lib/arc/v4-trade";
import { redactWalletError } from "@/lib/crypto/secret-box";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; side?: "buy" | "sell"; amount?: string };
    if (!body.token || !isAddress(body.token)) return NextResponse.json({ error: "The Arc token address is invalid." }, { status: 400 });
    if (body.side !== "buy" && body.side !== "sell") return NextResponse.json({ error: "Choose buy or sell." }, { status: 400 });
    if (!body.amount || !/^\d+(\.\d+)?$/.test(body.amount) || Number(body.amount) <= 0) return NextResponse.json({ error: "Trade amount must be greater than zero." }, { status: 400 });
    return NextResponse.json(await tradeArcV4({ token: body.token, side: body.side, amountUi: body.amount }));
  } catch (error) {
    return NextResponse.json({ error: redactWalletError(error) }, { status: 400 });
  }
}
