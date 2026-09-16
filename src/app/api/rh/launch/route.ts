import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { launchWithPons, type PonsLaunchInput } from "@/lib/rh/pons";
import { deskRhWallet } from "@/lib/wallets/rh-client";
import { RH } from "@onceupon/config/rh";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizeUrl(raw: string | undefined, kind: "website" | "twitter" | "telegram", fallback = "") {
  const value = (raw ?? "").trim();
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value)) return value;
  if (kind === "twitter") return `https://x.com/${value.replace(/^@/, "")}`;
  if (kind === "telegram") return `https://t.me/${value.replace(/^@/, "")}`;
  return `https://${value}`;
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export async function POST(request: Request) {
  try {
    const { user, profile } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
    const body = (await request.json()) as {
      name?: string; symbol?: string; coverUrl?: string; description?: string;
      website?: string; twitter?: string; telegram?: string;
    };
    const name = (body.name ?? "").trim().slice(0, 32);
    const symbol = (body.symbol ?? "").trim().toUpperCase().slice(0, 12);
    if (!name || !symbol) return NextResponse.json({ error: "Name and ticker required." }, { status: 400 });

    const { address, wallet, pub } = await deskRhWallet(user.id);
    const twitter = normalizeUrl(body.twitter, "twitter", profile?.handle ? `https://x.com/${profile.handle}` : "");
    const website = normalizeUrl(body.website, "website", PUBLIC_SITE_URL);
    const telegram = normalizeUrl(body.telegram, "telegram");
    const result = await launchWithPons({
      name,
      symbol,
      description: `${(body.description ?? "").trim() || "Launched on OrbitX"}\n\nOfficial launchpad: OrbitX · https://www.orbitxtrade.world · X: https://x.com/orbitx_wrld`,
      logo: body.coverUrl || `${PUBLIC_SITE_URL}/brand/logo.jpg`,
      twitter,
      website,
      telegram,
      creator: address,
      creatorTaxBps: 100,
      buybackEnabled: false,
      wallet,
      pub,
    });

    const slug = `${slugify(name) || slugify(symbol) || "token"}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const supabase = createServiceClient();
      await supabase.from("stories").insert({
        slug, title: name, ticker: symbol, blurb: body.description ?? "Launched on OrbitX",
        cover_url: body.coverUrl ?? null, image_uri: body.coverUrl ?? null,
        website_url: website || null, twitter_url: twitter || null, telegram_url: telegram || null,
        author_user_id: user.id, author_wallet: address, engine: "author", status: "live",
        author_bps: 100, chain: "robinhood", venue: "pons", pair_class: "other", pair_label: "ETH",
        mint_decimals: 18, token_address: result.token, vault_address: result.curve, curve_address: result.curve, created_tx: result.hash,
      });
    } catch (error) {
      console.error("RH Par launch: stories insert failed", error);
    }

    return NextResponse.json({
      ...result, slug, creator: address, feeRecipient: address,
      explorer: `${RH.explorer}/tx/${result.hash}`, venue: "pons",
      note: "PairPad multi-market launch on Robinhood Chain.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Robinhood launch failed." },
      { status: 400 },
    );
  }
}
