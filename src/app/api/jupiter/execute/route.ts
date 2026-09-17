import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchJupiterSwap } from "@/lib/jupiter";
import { deskSolanaKey, signAndSendDeskTx } from "@/lib/wallets/sign-desk";
import { redactWalletError } from "@/lib/crypto/secret-box";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
    const body = (await request.json()) as { quoteResponse?: Record<string, unknown> };
    if (!body.quoteResponse) {
      return NextResponse.json({ error: "Get a Jupiter route first." }, { status: 400 });
    }
    const payer = await deskSolanaKey(user.id);
    const { swapTransaction } = await fetchJupiterSwap({
      userPublicKey: payer.publicKey.toBase58(),
      quoteResponse: body.quoteResponse,
    });
    const sent = await signAndSendDeskTx(user.id, swapTransaction, true);
    return NextResponse.json(sent);
  } catch (error) {
    return NextResponse.json({ error: redactWalletError(error) }, { status: 400 });
  }
}
