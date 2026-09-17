import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deskEvmWallet } from "@/lib/wallets/sign-desk";
import { ARC_USDC, ARGUS_BOND_FDV_USDC6, launchWithArgus } from "@/lib/arc/argus";
import { createServiceClient } from "@/lib/supabase/service";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";
import { httpImageUrl } from "@/lib/media/token-json";
import { createPublicClient, http } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function normalizeUrl(raw: string | undefined | null, kind: "website" | "twitter" | "telegram") {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (kind === "twitter") return `https://x.com/${value.replace(/^@/, "")}`;
  if (kind === "telegram") return `https://t.me/${value.replace(/^@/, "")}`;
  return `https://${value}`;
}

export async function POST(request: Request) {
  try {
    const { profile, user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in before launching." }, { status: 401 });
    const body = (await request.json()) as {
      title?: string; ticker?: string; blurb?: string; coverUrl?: string | null; imageUri?: string | null;
      website?: string | null; twitter?: string | null; telegram?: string | null;
      rightsAttested?: boolean; seedUsdc?: number | string | null;
    };
    const title = (body.title ?? "").trim();
    const ticker = (body.ticker ?? "").trim().toUpperCase();
    if (!title || !ticker) return NextResponse.json({ error: "Name and ticker are required." }, { status: 400 });
    if (!body.rightsAttested) return NextResponse.json({ error: "Attest you have the rights to the art and name." }, { status: 400 });
    const { wallet, address } = await deskEvmWallet(user.id);
    const pub = createPublicClient({ chain: wallet.chain, transport: http(wallet.chain.rpcUrls.default.http[0]) });
    const twitter = normalizeUrl(body.twitter, "twitter") || (profile?.handle ? `https://x.com/${profile.handle}` : "");
    const website = normalizeUrl(body.website, "website") || process.env.NEXT_PUBLIC_SITE_URL || PUBLIC_SITE_URL;
    const telegram = normalizeUrl(body.telegram, "telegram");
    const logo = body.imageUri || body.coverUrl ? httpImageUrl(body.imageUri, body.coverUrl) : undefined;
    const result = await launchWithArgus({
      name: title, symbol: ticker, creator: address,
      logo,
      twitter: twitter || undefined,
      telegram: telegram || undefined,
      website, blurb: body.blurb ?? undefined, wallet, pub,
      seedUsdc: body.seedUsdc,
    });
    const slug = `${slugify(title) || slugify(ticker) || "token"}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const supabase = createServiceClient();
      const inserted = await supabase.from("stories").insert({
        slug, title, ticker, blurb: body.blurb ?? "Launched on OrbitX",
        cover_url: body.coverUrl ?? logo ?? null, image_uri: logo ?? body.coverUrl ?? null,
        website_url: website, twitter_url: twitter || null, telegram_url: telegram || null,
        author_user_id: user.id, author_wallet: address, engine: "author", status: "live",
        author_bps: 0, chain: "arc", venue: "argus-v4", pair_class: "usdc",
        pair_label: "USDC", quote_mint: ARC_USDC, quote_address: ARC_USDC,
        mint_decimals: 18, quote_decimals: 6, supply: result.supply,
        token_address: result.token, vault_address: result.hook,
        linked_pool_address: result.poolId, linked_pool_dex: "uniswap-v4",
        linked_pool_label: "Argus v4 PoolManager", created_tx: result.hash,
        curve_quote_lamports: result.seedUsdc6,
        graduation_quote_raw: ARGUS_BOND_FDV_USDC6.toString(),
      }).select("id").single();
      const storyId = inserted.data?.id;
      if (storyId) {
        await supabase.from("bindings").insert({
          story_id: storyId,
          kind: "amm_v3",
          is_primary: true,
          chain_caip2: "eip155:5042",
          pool_address: result.poolId,
          quote_address: ARC_USDC,
          mechanism: "uniswap_v4",
          proof_url: result.explorer,
          depth_usd: result.seedUsdc,
          created_tx: result.hash,
          verified_at: new Date().toISOString(),
        });
      }
    } catch (insertError) {
      console.error("Argus launch: stories insert failed", insertError);
    }
    return NextResponse.json({
      ...result, slug, creator: address, venue: "argus-v4-arc-mainnet", chainId: 5042,
      note: `Argus Portal #7 v4 launch confirmed with ${result.seedUsdc} USDC seed liquidity.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Arc launch failed." }, { status: 400 });
  }
}
