import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { VanityTimeoutError, VANITY_SUFFIX } from "@/lib/solana/vanity";
import { resolveLaunchMint, vanityMintFromSecret } from "@/lib/solana/vanity-mine";
import { buildCreateV2Tx, parseQuoteMintChoice, type PoolPairChoice } from "@/lib/solana/pump-sdk";
import { sendSignedTx, waitForTx, explorerFromSig } from "@/lib/solana/partial-tx";
import { fetchLatestBlockhash } from "@/lib/solana/blockhash";
import { serverSolanaRpcs } from "@/lib/solana/rpc-urls";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import { createServiceClient } from "@/lib/supabase/service";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";
import { PAD_NAME, metadataDescription, tokenMetadataUri } from "@onceupon/config/launchpad";
import { pinJson } from "@/lib/media/pin";
import { buildPumpTokenMetadata, chooseMetadataUri, httpImageUrl } from "@/lib/media/token-json";

const ORBITX_BRAND_LOGO = `${PUBLIC_SITE_URL}/brand/logo.jpg`;
const ORBITX_BRAND_X = "https://x.com/orbitx_wrld";
const ORBITX_BRAND_TELEGRAM = "https://t.me/orbitx_wrld";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function normalizeUrl(raw: string | undefined, kind: "website" | "twitter" | "telegram") {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (kind === "twitter") return `https://x.com/${value.replace(/^@/, "")}`;
  if (kind === "telegram") return `https://t.me/${value.replace(/^@/, "")}`;
  return `https://${value}`;
}

export async function POST(request: Request) {
  let slug: string | undefined;
  try {
    const { user, profile } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
    const body = (await request.json()) as {
      name?: string;
      symbol?: string;
      blurb?: string;
      website?: string;
      twitter?: string;
      telegram?: string;
      metadataUri?: string;
      coverUrl?: string;
      imageUri?: string;
      vanity?: boolean;
      mintSecret?: string;
      poolPair?: PoolPairChoice;
      customQuoteMint?: string;
      mayhemMode?: boolean;
      rewardsTo?: "creator" | "holders";
      creatorFeeBps?: number;
    };
    const name = (body.name ?? "").trim();
    const symbol = (body.symbol ?? "").trim().toUpperCase().slice(0, 10);
    if (!name || !symbol) return NextResponse.json({ error: "Name and ticker required." }, { status: 400 });

    const poolPair: PoolPairChoice = body.poolPair === "usdc" || body.poolPair === "custom" ? body.poolPair : "sol";
    const quoteMint = parseQuoteMintChoice(poolPair, body.customQuoteMint);
    // Disabled server-side too: we haven't been able to confirm this works
    // correctly on-chain (built from real SDK types but never watched succeed
    // on a live transaction), so it's hard-blocked regardless of what a
    // direct API call requests, not just hidden in the UI.
    const mayhemMode = false;
    void body.mayhemMode;
    const holderReward = body.rewardsTo === "holders";
    const requestedFeeBps = Math.max(0, Math.min(300, Math.round(Number(body.creatorFeeBps ?? 0))));

    const payer = await deskSolanaKey(user.id);
    // Throws VanityTimeoutError if a vanity mint was requested and not found.
    // Nothing has been sent on-chain at this point, so that is a clean retry.
    const prepared = typeof body.mintSecret === "string" ? vanityMintFromSecret(body.mintSecret) : null;
    const minted = prepared ?? (await resolveLaunchMint(body.vanity !== false));
    const mintAddress = minted.keypair.publicKey.toBase58();

    const blurb = (body.blurb ?? "").trim();
    const websiteUrl = normalizeUrl(body.website, "website");
    const twitterUrl = normalizeUrl(body.twitter, "twitter");
    const telegramUrl = normalizeUrl(body.telegram, "telegram");
    const image = httpImageUrl(body.imageUri, body.coverUrl, ORBITX_BRAND_LOGO);
    const metadataJson = buildPumpTokenMetadata({
      name,
      symbol,
      description: metadataDescription(blurb, profile?.handle),
      image,
      twitter: twitterUrl,
      telegram: telegramUrl,
      website: websiteUrl,
    });
    // Pin JSON so pump.fun / DexScreener fetch description + links from IPFS.
    // Never pass the cover image as `uri` — that is why off-platform pages were
    // blank even though OrbitX's own story row had the fields.
    const pinned = await pinJson(metadataJson, `${symbol.toLowerCase()}-metadata.json`);
    const metadataUri = chooseMetadataUri({
      fallbackUri: tokenMetadataUri(mintAddress),
      pinnedGatewayUrl: pinned?.gatewayUrl,
      clientUri: body.metadataUri,
    });

    slug = `${slugify(name) || slugify(symbol) || "token"}-${Math.random().toString(36).slice(2, 6)}`;

    // Persist the story record before minting so the fallback metadata URL
    // (fetched by pump.fun's indexer after the tx lands) already resolves to
    // the real name/description/links instead of generic branding. Uses the
    // service-role client: the session-scoped client was silently hitting
    // stories' RLS INSERT policy.
    try {
      const supabase = createServiceClient();
      await supabase.from("stories").insert({
        slug,
        title: name,
        ticker: symbol,
        blurb,
        cover_url: body.coverUrl || image,
        image_uri: body.imageUri || image,
        metadata_uri: metadataUri,
        website_url: websiteUrl,
        twitter_url: twitterUrl,
        telegram_url: telegramUrl,
        author_user_id: user.id,
        author_wallet: payer.publicKey.toBase58(),
        engine: holderReward ? "onceuponers" : "author",
        status: "live",
        author_bps: requestedFeeBps,
        chain: "solana",
        venue: "pumpfun",
        pair_class: poolPair === "usdc" ? "usdc" : poolPair === "custom" ? "other" : "sol",
        pair_label: poolPair === "usdc" ? "USDC" : poolPair === "custom" ? "Custom" : "SOL",
        mint_decimals: 6,
        quote_mint: quoteMint ? quoteMint.toBase58() : null,
        token_address: mintAddress,
      });
    } catch (error) {
      // Don't block a successful on-chain launch on a DB write failure, but do log it —
      // this exact silence is what hid the RLS bug above for two days.
      console.error("solana launch: stories insert failed", error);
    }

    const built = await buildCreateV2Tx({
      mint: minted.keypair.publicKey,
      name,
      symbol,
      uri: metadataUri,
      payer: payer.publicKey,
      mayhemMode,
      holderReward,
      creatorFeeBps: requestedFeeBps,
      quoteMint,
    });

    const latest = await fetchLatestBlockhash(serverSolanaRpcs());
    built.tx.feePayer = payer.publicKey;
    built.tx.recentBlockhash = latest.blockhash;
    built.tx.sign(minted.keypair, payer);
    const raw = built.tx.serialize();
    const signature = await sendSignedTx(raw.toString("base64"));
    await waitForTx(signature);

    return NextResponse.json({
      mint: mintAddress,
      slug,
      signature,
      explorer: explorerFromSig(signature),
      creator: payer.publicKey.toBase58(),
      vanity: minted.vanity,
      suffix: VANITY_SUFFIX,
      tries: minted.tries,
      poolPair,
      quoteMint: quoteMint ? quoteMint.toBase58() : null,
      mayhemMode,
      holderReward,
      appliedCreatorFeeBps: built.appliedCreatorFeeBps,
      metadata: {
        ...metadataJson,
        uri: metadataUri,
        fallbackUri: tokenMetadataUri(mintAddress),
        launchpad: PAD_NAME,
        brand: "OrbitX",
        brandName: "OrbitX",
        brandUrl: PUBLIC_SITE_URL,
        brandLogo: ORBITX_BRAND_LOGO,
        officialX: ORBITX_BRAND_X,
        officialTelegram: ORBITX_BRAND_TELEGRAM,
        creatorX: profile?.handle ? `@${profile.handle}` : "",
      },
    });
  } catch (error) {
    // A vanity timeout happens before anything is sent on-chain and before the
    // stories row is written, so it is a clean retry rather than a failed launch.
    // Returned as 503 + retryable so the client can offer "try again" instead of
    // silently producing a non-vanity token, which is what used to happen.
    if (error instanceof VanityTimeoutError) {
      return NextResponse.json(
        {
          error: error.message,
          retryable: true,
          suffix: error.suffix,
          tries: error.tries,
        },
        { status: 503 },
      );
    }
    // If we already inserted a "live" stories row optimistically (so the metadata
    // endpoint would resolve before pump.fun's indexer asked for it) and the mint
    // transaction itself then failed on-chain, that row would otherwise sit on the
    // feed forever as a live token with nothing behind it. Archive it.
    if (typeof slug === "string") {
      try {
        const supabase = createServiceClient();
        await supabase.from("stories").update({ status: "archived" }).eq("slug", slug).eq("status", "live");
      } catch {
        // best-effort cleanup only
      }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not launch on Solana." },
      { status: 400 },
    );
  }
}
