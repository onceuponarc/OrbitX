import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listLocalArcStories, localTape } from "@/lib/arc/store";
import { enrichLaunch, feedFromArc, isListedLaunch, type FeedLaunch, type RawTrade, type TapeItem } from "@/lib/feed";
import { getPumpBondingProgress } from "@/lib/solana/pump-progress";
import { OFFICIAL_TOKEN } from "@/lib/official-token";
import {
  loadTokenVolumes,
  overlayLaunchVolume,
  sumPadVolume,
  volumeKey,
  type PadVolume,
} from "@/lib/token-volume";

type StoryRow = {
  id: string;
  slug: string;
  title: string;
  ticker: string;
  blurb: string | null;
  engine: "author" | "onceuponers";
  pair_label: string;
  author_bps: number;
  cover_url: string | null;
  status: FeedLaunch["status"];
  created_at: string;
  chain?: string | null;
  venue?: string | null;
  curve_quote_lamports?: number | string | null;
  graduation_quote_raw?: number | string | null;
  quote_decimals?: number | null;
  mint_decimals?: number | null;
  supply?: number | string | null;
  token_address?: string | null;
  quote_mint?: string | null;
  quote_address?: string | null;
  users: { handle: string } | { handle: string }[] | null;
};

export async function loadPadMarket(): Promise<{ launches: FeedLaunch[]; tape: TapeItem[]; volume: PadVolume }> {
  const local = listLocalArcStories().map(feedFromArc);
  const tape: TapeItem[] = localTape(24).map((item) => ({
    slug: item.slug,
    ticker: item.ticker,
    side: item.side,
    quoteUi: item.quoteUi,
    trader: item.trader,
    at: item.at,
    txHash: item.txHash,
  }));

  try {
    const supabase = await createClient();
    const { data: storyRows } = await supabase
      .from("stories")
      .select(
        "id, slug, title, ticker, blurb, engine, pair_label, author_bps, cover_url, status, created_at, chain, venue, token_address, quote_mint, curve_quote_lamports, graduation_quote_raw, quote_decimals, mint_decimals, supply, users:author_user_id(handle)",
      )
      .in("status", ["live", "graduated"])
      .in("chain", ["arc", "solana", "robinhood"])
      .order("created_at", { ascending: false })
      .limit(48);

    const stories = (storyRows ?? []) as unknown as StoryRow[];
    const ids = stories.map((row) => row.id);
    const tradesByStory = new Map<string, RawTrade[]>();
    if (ids.length) {
      const { data: tradeRows } = await supabase
        .from("trades")
        .select("story_id, side, trader, amount_in, amount_out, traded_at, price_usd")
        .in("story_id", ids)
        .order("traded_at", { ascending: true });
      for (const row of tradeRows ?? []) {
        const story = stories.find((item) => item.id === row.story_id);
        const list = tradesByStory.get(row.story_id) ?? [];
        list.push({
          storyId: row.story_id,
          slug: story?.slug,
          side: String(row.side),
          amountIn: Number(row.amount_in ?? 0),
          amountOut: Number(row.amount_out ?? 0),
          quoteDecimals: Number(story?.quote_decimals ?? 6),
          baseDecimals: Number(story?.mint_decimals ?? 6),
          trader: String(row.trader ?? ""),
          at: String(row.traded_at),
          priceUsd: row.price_usd != null ? Number(row.price_usd) : null,
        });
        tradesByStory.set(row.story_id, list);
        if (story) {
          const qDec = Number(story.quote_decimals ?? 6);
          const quoteUi =
            row.side === "buy" ? Number(row.amount_in ?? 0) / 10 ** qDec : Number(row.amount_out ?? 0) / 10 ** qDec;
          tape.push({
            slug: story.slug,
            ticker: story.ticker,
            side: row.side === "sell" ? "sell" : "buy",
            quoteUi,
            trader: String(row.trader ?? ""),
            at: String(row.traded_at),
          });
        }
      }
    }

    const remote: FeedLaunch[] = await Promise.all(
      stories.map(async (row) => {
        const author = Array.isArray(row.users) ? row.users[0] : row.users;
        const qDec = Number(row.quote_decimals ?? 9);
        const launch = enrichLaunch(
          {
            slug: row.slug,
            title: row.title,
            ticker: row.ticker,
            blurb: row.blurb ?? "",
            engine: row.engine,
            pairLabel: row.pair_label,
            authorBps: row.author_bps,
            status: row.status,
            coverUrl: row.cover_url,
            handle: author && "handle" in author ? String(author.handle) : null,
            createdAt: row.created_at,
            chain: row.chain ?? "arc",
            venue: row.venue ?? "spl",
            tokenAddress: row.token_address ?? null,
            quoteAddress: row.quote_address ?? row.quote_mint ?? null,
          },
          tradesByStory.get(row.id) ?? [],
          {
            curveQuoteUi: Number(row.curve_quote_lamports ?? 0) / 10 ** qDec,
            graduateUi: Number(row.graduation_quote_raw ?? 0) / 10 ** qDec,
          },
        );
        // Solana tokens trade on pump.fun's own bonding curve, not ours — pull
        // the real graduation progress from pump.fun rather than showing 0%.
        if (row.chain === "solana" && row.token_address) {
          const bonding = await getPumpBondingProgress(row.token_address).catch(() => null);
          if (bonding) {
            launch.progressBps = bonding.progressBps;
            if (bonding.graduated) launch.status = "graduated";
          }
        }
        return launch;
      }),
    );

    const seen = new Set(remote.map((item) => item.slug));
    const merged = [...local.filter((item) => !seen.has(item.slug)), ...remote].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
    const { launches, volume } = await withMarketVolume(merged.filter(isListedLaunch));
    tape.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    const listedSlugs = new Set(launches.map((item) => item.slug));
    return {
      launches,
      tape: tape.filter((item) => listedSlugs.has(item.slug)).slice(0, 24),
      volume,
    };
  } catch (error) {
    console.error("Pad market failed", error);
    const { launches, volume } = await withMarketVolume(local.filter(isListedLaunch));
    return {
      launches,
      tape: tape.filter((item) => launches.some((row) => row.slug === item.slug)).slice(0, 24),
      volume,
    };
  }
}

async function withMarketVolume(launches: FeedLaunch[]): Promise<{ launches: FeedLaunch[]; volume: PadVolume }> {
  const tokens = launches
    .filter((item) => item.tokenAddress)
    .map((item) => ({ chain: item.chain ?? "arc", mint: item.tokenAddress as string }));
  tokens.push({ chain: "solana", mint: OFFICIAL_TOKEN.mint });
  const volumes = await loadTokenVolumes(tokens).catch(() => new Map());
  const next = launches.map((launch) => {
    if (!launch.tokenAddress) return launch;
    return overlayLaunchVolume(launch, volumes.get(volumeKey(launch.chain ?? "arc", launch.tokenAddress)));
  });
  const official = volumes.get(volumeKey("solana", OFFICIAL_TOKEN.mint));
  const hasOfficial = next.some((item) => item.tokenAddress === OFFICIAL_TOKEN.mint);
  // Official $ORBITX is the live flagship mint; include it in pad totals even
  // when it is not a row on the public launch board.
  return { launches: next, volume: sumPadVolume(next, hasOfficial ? null : official) };
}
