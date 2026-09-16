import { NextResponse } from "next/server";
import { pumpCollectFeeTx } from "@/lib/solana/pumpportal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Builds Pump.fun's real collectCreatorFee transaction for the connected wallet.
 * The wallet signs locally; OrbitX never receives a private key or submits on its behalf.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { publicKey?: string };
    const publicKey = (body.publicKey ?? "").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey)) {
      return NextResponse.json({ error: "Enter a valid Solana wallet address." }, { status: 400 });
    }
    const transaction = await pumpCollectFeeTx(publicKey);
    return NextResponse.json({ transaction, creator: publicKey, mechanism: "collectCreatorFee" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build the Pump.fun claim transaction." },
      { status: 400 },
    );
  }
}
