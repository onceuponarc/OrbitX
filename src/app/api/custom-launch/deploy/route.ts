import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deployCustomLaunch } from "@/lib/custom-launch/deploy";
import { customLaunchAdapter } from "@/lib/custom-launch/onchain";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { deskEvmWallet, deskSolanaKey } from "@/lib/wallets/sign-desk";
import { deskRhWallet } from "@/lib/wallets/rh-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in before deploying a Custom Launch." }, { status: 401 });
    const body = (await request.json()) as { draft?: CustomLaunchDraft };
    const draft = body.draft;
    if (!draft || draft.version !== 4) {
      return NextResponse.json({ error: "Invalid Custom Launch draft." }, { status: 400 });
    }
    if (draft.chain !== "solana" && draft.chain !== "arc" && draft.chain !== "robinhood") {
      return NextResponse.json({ error: "Unsupported chain." }, { status: 400 });
    }
    const caps = customLaunchAdapter(draft.chain).capabilities();
    if (!caps.tokenCreate) {
      return NextResponse.json({ error: caps.note, capabilities: caps }, { status: 409 });
    }
    const creatorAddress =
      draft.chain === "solana"
        ? (await deskSolanaKey(user.id)).publicKey.toBase58()
        : draft.chain === "robinhood"
          ? (await deskRhWallet(user.id)).address
          : (await deskEvmWallet(user.id)).address;
    const result = await deployCustomLaunch({ userId: user.id, draft, creatorAddress });
    return NextResponse.json({
      launchId: result.launchId,
      slug: result.slug,
      tokenAddress: result.tokenAddress,
      poolAddress: result.poolAddress,
      hubAddress: result.hubAddress,
      routerAddress: result.routerAddress,
      txHash: result.txHash,
      explorer: result.explorer,
      capabilities: caps,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Custom Launch deployment failed." },
      { status: 400 },
    );
  }
}
