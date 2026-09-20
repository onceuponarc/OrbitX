import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { customLaunchAdapter } from "@/lib/custom-launch/onchain";
import { isPrintableChain } from "@onceupon/config/solana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const chain = new URL(request.url).searchParams.get("chain");
  if (!chain || !isPrintableChain(chain)) {
    return NextResponse.json({ error: "Unsupported chain." }, { status: 400 });
  }
  const { user, profile } = await getSessionUser();
  return NextResponse.json({
    signedIn: Boolean(user),
    handle: profile?.handle ?? null,
    capabilities: customLaunchAdapter(chain).capabilities(),
  });
}
