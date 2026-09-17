import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";
import { PAD_CREATED_ON, PAD_NAME, metadataDescription, venueLabel } from "@onceupon/config/launchpad";
import { buildPumpTokenMetadata, httpImageUrl } from "@/lib/media/token-json";

const FULL =
  "title, ticker, blurb, cover_url, image_uri, twitter_url, telegram_url, website_url, venue, chain, slug, engine, supply, mint_decimals, author_bps, protocol_bps, pair_label, users:author_user_id(handle)";
const MIN = "title, ticker, blurb, cover_url, image_uri, twitter_url, telegram_url, website_url";

export const dynamic = "force-dynamic";

async function storiesClient() {
  try {
    return createServiceClient();
  } catch {
    return createClient();
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ mint: string }> },
) {
  const { mint } = await context.params;
  const supabase = await storiesClient();
  let { data } = await supabase.from("stories").select(FULL).eq("token_address", mint).maybeSingle();
  if (!data) {
    const fallback = await supabase.from("stories").select(MIN).eq("token_address", mint).maybeSingle();
    data = fallback.data as typeof data;
  }

  const author = data && "users" in data ? (Array.isArray(data.users) ? data.users[0] : data.users) : null;
  const handle = author && typeof author === "object" && "handle" in author ? String(author.handle) : null;
  const image = httpImageUrl(
    data && "image_uri" in data ? (data.image_uri as string | null) : null,
    data?.cover_url,
    `${PUBLIC_SITE_URL}/brand/logo.jpg`,
  );
  const twitter = data && "twitter_url" in data ? (data.twitter_url as string | null) : null;
  const telegram = data && "telegram_url" in data ? (data.telegram_url as string | null) : null;
  const website = data && "website_url" in data ? (data.website_url as string | null) : null;
  const venue = data && "venue" in data ? String(data.venue ?? "spl") : "spl";
  const engine = data && "engine" in data ? String(data.engine ?? "author") : "author";
  const supply = data && "supply" in data ? data.supply : null;
  const mintDecimals = data && "mint_decimals" in data ? Number(data.mint_decimals ?? 6) : 6;
  const authorBps = data && "author_bps" in data ? Number(data.author_bps ?? 0) : 0;
  const protocolBps = data && "protocol_bps" in data ? Number(data.protocol_bps ?? 20) : 20;
  const pairLabel = data && "pair_label" in data ? String(data.pair_label ?? "") : "";

  const metadata = buildPumpTokenMetadata({
    name: data?.title ?? PAD_NAME,
    symbol: data?.ticker ?? "ORBX",
    description: metadataDescription(data?.blurb ?? "", handle),
    image,
    twitter,
    telegram,
    website,
  });

  return NextResponse.json(
    {
      ...metadata,
      launchpad: PAD_NAME,
      venue: venueLabel(venue),
      decimals: mintDecimals,
      supply: supply != null ? String(supply) : undefined,
      tokenomics: {
        rewardMode: engine === "onceuponers" ? "holder_claim" : "creator_stream",
        creatorBps: authorBps,
        protocolBps,
        pair: pairLabel || undefined,
      },
      createdOn: metadata.createdOn || PAD_CREATED_ON,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
