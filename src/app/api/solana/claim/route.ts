import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { collectCreatorFeeTransaction } from "@/lib/solana/claim-fees";
import { deskSolanaKey, signAndSendDeskTx } from "@/lib/wallets/sign-desk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Collect pump.fun creator fees into the in-app Solana desk. */
export async function POST() {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
    const payer = await deskSolanaKey(user.id);
    const built = await collectCreatorFeeTransaction(payer.publicKey);
    const sent = await signAndSendDeskTx(user.id, built.transaction, built.versioned, { confirmMs: 12_000 });
    return NextResponse.json({
      ...sent,
      creator: payer.publicKey.toBase58(),
      mechanism: "collectCreatorFee",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not claim Pump.fun creator fees." },
      { status: 400 },
    );
  }
}
