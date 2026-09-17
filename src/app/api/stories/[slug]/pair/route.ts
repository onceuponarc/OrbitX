import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildPumpSwapPair, confirmPumpSwapPair, waitPairTx } from "@/lib/solana/pumpswap-pool";
import { signAndSendDeskTx } from "@/lib/wallets/sign-desk";
import { redactWalletError } from "@/lib/crypto/secret-box";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PairBody = {
  action?: "build" | "wait" | "confirm" | "open";
  quoteMint?: string | null;
  quoteUi?: number;
  baseBps?: number;
  recentBlockhash?: string;
  signature?: string;
  pool?: string;
  fromVault?: boolean;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { user } = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
  const { slug } = await context.params;

  let body: PairBody;
  try {
    body = (await request.json()) as PairBody;
  } catch {
    return NextResponse.json({ error: "Pair request was empty." }, { status: 400 });
  }

  try {
    if (body.action === "wait") {
      if (!body.signature) {
        return NextResponse.json({ error: "Wait needs a signature." }, { status: 400 });
      }
      const result = await waitPairTx(body.signature);
      return NextResponse.json(result);
    }
    if (body.action === "confirm") {
      if (!body.signature || !body.pool) {
        return NextResponse.json({ error: "Confirmation needs a signature and pool." }, { status: 400 });
      }
      const result = await confirmPumpSwapPair({
        userId: user.id,
        slug,
        signature: body.signature,
        pool: body.pool,
        quoteMint: body.quoteMint,
      });
      return NextResponse.json(result);
    }

    const built = await buildPumpSwapPair({
      userId: user.id,
      slug,
      quoteMint: body.quoteMint,
      quoteUi: Number(body.quoteUi ?? 0),
      baseBps: body.baseBps == null ? undefined : Number(body.baseBps),
      recentBlockhash: body.recentBlockhash,
      fromVault: Boolean(body.fromVault),
    });
    const txs =
      Array.isArray(built.transactions) && built.transactions.length
        ? built.transactions
        : "transaction" in built && typeof built.transaction === "string"
          ? [built.transaction]
          : [];
    let sent = { signature: built.already ? "existing" : "", explorer: built.explorer };
    if (!built.already) {
      if (!txs.length) return NextResponse.json({ error: "The pad did not return a transaction." }, { status: 400 });
      for (let i = 0; i < txs.length; i += 1) {
        sent = await signAndSendDeskTx(user.id, txs[i]);
        if (i < txs.length - 1) await waitPairTx(sent.signature);
      }
    }
    const confirmed = await confirmPumpSwapPair({
      userId: user.id,
      slug,
      signature: sent.signature || "existing",
      pool: built.pool,
      quoteMint: built.quoteMint,
    });
    return NextResponse.json({
      ...built,
      ...confirmed,
      signature: sent.signature,
      explorer: sent.explorer || confirmed.explorer,
    });
  } catch (error) {
    console.error("pair route failed", error);
    return NextResponse.json({ error: redactWalletError(error) }, { status: 400 });
  }
}
