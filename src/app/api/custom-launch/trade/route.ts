import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { tradeCustomLaunchCurve } from "@/lib/custom-launch/onchain/solana-curve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in before trading a Custom Launch curve." }, { status: 401 });
    const body = (await request.json()) as { slug?: string; side?: string; amountUi?: number };
    if (!body.slug || (body.side !== "buy" && body.side !== "sell")) {
      return NextResponse.json({ error: "slug and side (buy|sell) are required." }, { status: 400 });
    }
    const amountUi = Number(body.amountUi);
    if (!Number.isFinite(amountUi) || amountUi <= 0) {
      return NextResponse.json({ error: "amountUi must be a positive number." }, { status: 400 });
    }
    const result = await tradeCustomLaunchCurve({
      userId: user.id,
      slug: body.slug,
      side: body.side,
      amountUi,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Custom Launch curve trade failed." },
      { status: 400 },
    );
  }
}
