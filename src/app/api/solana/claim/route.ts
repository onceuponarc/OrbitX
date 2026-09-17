import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pumpCollectFeeTx } from "@/lib/solana/pumpportal";
import { deskSolanaKey, signAndSendDeskTx } from "@/lib/wallets/sign-desk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Collect pump.fun creator fees into the in-app Solana desk. */
export async function POST() {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
    const payer = await deskSolanaKey(user.id);
    const transaction = await pumpCollectFeeTx(payer.publicKey.toBase58());
    const sent = await signAndSendDeskTx(user.id, transaction, true);
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
