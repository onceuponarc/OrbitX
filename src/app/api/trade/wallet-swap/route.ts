import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Swaps are signed by your in-app Solana desk. POST /api/trade/swap after signing in with X." },
    { status: 410 },
  );
}
