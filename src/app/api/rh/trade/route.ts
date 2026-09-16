import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { tradeOnPons } from "@/lib/rh/pons-trade";
import { redactWalletError } from "@/lib/crypto/secret-box";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in before trading." }, { status: 401 });
    const body = (await request.json()) as { token?: string; curve?: string; side?: "buy" | "sell"; amount?: string };
    if (!body.token || !/^0x[0-9a-fA-F]{40}$/.test(body.token)) return NextResponse.json({ error: "The token address is invalid." }, { status: 400 });
    if (!body.curve || !/^0x[0-9a-fA-F]{40}$/.test(body.curve)) return NextResponse.json({ error: "This launch has no recorded Pons curve address." }, { status: 400 });
    if (body.side !== "buy" && body.side !== "sell") return NextResponse.json({ error: "Choose buy or sell." }, { status: 400 });
    if (!body.amount || Number(body.amount) <= 0) return NextResponse.json({ error: "Trade amount must be greater than zero." }, { status: 400 });
    return NextResponse.json(await tradeOnPons({ userId: user.id, token: body.token as `0x${string}`, curve: body.curve as `0x${string}`, side: body.side, amountUi: body.amount }));
  } catch (error) {
    return NextResponse.json({ error: redactWalletError(error) }, { status: 400 });
  }
}
