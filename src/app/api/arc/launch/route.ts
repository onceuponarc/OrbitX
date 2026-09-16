import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deskEvmWallet } from "@/lib/wallets/sign-desk";
import { launchWithArcPad } from "@/lib/par/launchpad";
import { createServiceClient } from "@/lib/supabase/service";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";
import { createPublicClient, http, type Address } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function addressList(value: unknown): Address[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((x): x is string => typeof x === "string").map((x) => x.trim());
  if (!values.length) return undefined;
  if (values.some((x) => !/^0x[0-9a-fA-F]{40}$/.test(x))) throw new Error("Every quote asset must be a valid Arc address.");
  return values as Address[];
}

export async function POST(request: Request) {
  try {
    const { profile, user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in before launching." }, { status: 401 });
    const body = (await request.json()) as {
      title?: string; ticker?: string; blurb?: string; coverUrl?: string | null;
      rightsAttested?: boolean; creator?: string; quoteAssets?: unknown;
      feeMode?: string; creatorTaxBps?: number;
    };
    const title = (body.title ?? "").trim();
    const ticker = (body.ticker ?? "").trim().toUpperCase();
    if (!title || !ticker) return NextResponse.json({ error: "Name and ticker are required." }, { status: 400 });
    if (!body.rightsAttested) return NextResponse.json({ error: "Attest you have the rights to the art and name." }, { status: 400 });
    // Arc launches use ArcPad's permissionless fixed-supply launcher; legacy Par fee fields are ignored.
    const { wallet, address } = await deskEvmWallet(user.id);
    const pub = createPublicClient({ chain: wallet.chain, transport: http(wallet.chain.rpcUrls.default.http[0]) });
    const website = process.env.NEXT_PUBLIC_SITE_URL || PUBLIC_SITE_URL;
    const result = await launchWithArcPad({
      name: title, symbol: ticker, creator: address,
      description: body.blurb?.trim() || "Launched on OrbitX",
      logo: body.coverUrl || undefined,
      twitter: profile?.handle ? `https://x.com/${profile.handle}` : undefined,
      website, wallet, pub,
    });
    const slug = `${slugify(title) || slugify(ticker) || "token"}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const supabase = createServiceClient();
      await supabase.from("stories").insert({
        slug, title, ticker, blurb: body.blurb ?? "Launched on OrbitX",
        cover_url: body.coverUrl ?? null, image_uri: body.coverUrl ?? null,
        website_url: website, twitter_url: profile?.handle ? `https://x.com/${profile.handle}` : null,
        author_user_id: user.id, author_wallet: address, engine: "author", status: "live",
        author_bps: body.creatorTaxBps ?? 100, chain: "arc", venue: "arcpad", pair_class: "other",
        pair_label: "USDC", 
        mint_decimals: 18, token_address: result.token, created_tx: result.hash,
      });
    } catch (insertError) {
      console.error("Arc Par launch: stories insert failed", insertError);
    }
    return NextResponse.json({
      ...result, slug, creator: address, venue: "arcpad-arc-mainnet", chainId: 5042,
      note: "ArcPad fixed-supply launch with an Arc USDC pool and locked liquidity.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Arc launch failed." }, { status: 400 });
  }
}
