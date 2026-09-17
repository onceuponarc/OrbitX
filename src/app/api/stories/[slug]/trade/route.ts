import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buyOnCurve, claimPiece, confirmCurveTrade, fundHolderRewards, sellOnCurve } from "@/lib/solana/trade";
import { redactWalletError } from "@/lib/crypto/secret-box";
import { createClient } from "@/lib/supabase/server";
import { signAndSendDeskTx } from "@/lib/wallets/sign-desk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { user } = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
  const { slug } = await context.params;
  const body = (await request.json()) as {
    action?: "buy" | "sell" | "claim" | "fund";
    amount?: number;
  };

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("stories").select("mint_decimals").eq("slug", slug).maybeSingle();
    const decimals = Number(data?.mint_decimals ?? 6);
    const amount = Number(body.amount ?? 0);

    let built: { transaction: string; side: "buy" | "sell" | "claim" | "fund" };
    if (body.action === "buy") built = await buyOnCurve(user.id, slug, amount);
    else if (body.action === "sell") built = await sellOnCurve(user.id, slug, amount, decimals);
    else if (body.action === "claim") built = await claimPiece(user.id, slug);
    else if (body.action === "fund") built = await fundHolderRewards(user.id, slug, amount);
    else return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    const sent = await signAndSendDeskTx(user.id, built.transaction);
    const confirmed = await confirmCurveTrade(
      user.id,
      slug,
      sent.signature,
      built.side,
      amount,
      decimals,
      sent.payer,
    );
    return NextResponse.json({ ...confirmed, signature: sent.signature, explorer: sent.explorer });
  } catch (error) {
    return NextResponse.json({ error: redactWalletError(error) }, { status: 400 });
  }
}
