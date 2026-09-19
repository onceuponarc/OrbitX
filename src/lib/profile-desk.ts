import "server-only";

import { createClient } from "@/lib/supabase/server";
import { hiResPortrait, publicMediaUrl, xAvatarFallback } from "@/lib/media";
import { fetchXProfile } from "@/lib/x-profile";

import { isHiddenTestLaunch } from "@/lib/feed";
import type { ProfileDesk, ProfileFill, ProfileHold, ProfileLaunch } from "@/lib/profile-types";

function quoteUi(side: string, amountIn: number, amountOut: number, decimals: number) {
  const div = 10 ** (decimals || 6);
  return side === "buy" ? amountIn / div : amountOut / div;
}

function tokensUi(side: string, amountIn: number, amountOut: number) {
  const div = 1e18;
  return side === "buy" ? amountOut / div : amountIn / div;
}

export async function loadProfileDesk(handle: string, viewerId?: string | null): Promise<ProfileDesk | null> {
  const supabase = await createClient();
  let userQuery = await supabase
    .from("users")
    .select("id, handle, display_name, bio, portrait_url, storage_portrait_path, banner_url")
    .eq("handle", handle)
    .maybeSingle();
  if (userQuery.error) {
    userQuery = await supabase
      .from("users")
      .select("id, handle, display_name, bio, portrait_url, storage_portrait_path")
      .eq("handle", handle)
      .maybeSingle();
  }
  const user = userQuery.data as
    | {
        id: string;
        handle: string;
        display_name: string;
        bio: string | null;
        portrait_url: string | null;
        storage_portrait_path: string | null;
        banner_url?: string | null;
      }
    | null;
  if (!user) return null;
  const x = await fetchXProfile(user.handle);

  const { data: storyRows } = await supabase
    .from("stories")
    .select(
      "id, slug, title, ticker, status, cover_url, author_bps, quote_decimals, token_address, created_at, chain",
    )
    .eq("author_user_id", user.id)
    .order("created_at", { ascending: false });
  let walletRows: { address?: string }[] = [];
  try {
    const wallets = await supabase.from("user_wallets").select("address").eq("user_id", user.id);
    walletRows = (wallets.data ?? []) as { address?: string }[];
  } catch {
    walletRows = [];
  }

  const stories = (storyRows ?? []).filter(
    (row) => (row.status === "live" || row.status === "graduated") && !isHiddenTestLaunch(row),
  );
  const storyIds = stories.map((row) => row.id);
  const wallets = new Set(
    (walletRows ?? [])
      .map((row) => String((row as { address?: string }).address ?? "").toLowerCase())
      .filter(Boolean),
  );

  type TradeRow = {
    story_id: string;
    side: string;
    trader: string | null;
    amount_in: number | string | null;
    amount_out: number | string | null;
    traded_at: string;
    tx_hash: string | null;
  };
  let trades: TradeRow[] = [];
  if (storyIds.length) {
    const { data } = await supabase
      .from("trades")
      .select("story_id, side, trader, amount_in, amount_out, traded_at, tx_hash")
      .in("story_id", storyIds)
      .order("traded_at", { ascending: false })
      .limit(200);
    trades = (data ?? []) as TradeRow[];
  }

  const byStory = new Map<string, TradeRow[]>();
  for (const trade of trades) {
    const list = byStory.get(trade.story_id) ?? [];
    list.push(trade);
    byStory.set(trade.story_id, list);
  }

  const launches: ProfileLaunch[] = stories.map((row) => {
    const rows = byStory.get(row.id) ?? [];
    const decimals = Number(row.quote_decimals ?? 6);
    let volumeUi = 0;
    for (const trade of rows) {
      volumeUi += quoteUi(trade.side, Number(trade.amount_in ?? 0), Number(trade.amount_out ?? 0), decimals);
    }
    const authorBps = Number(row.author_bps ?? 0);
    return {
      slug: row.slug,
      title: row.title,
      ticker: row.ticker,
      status: row.status,
      coverUrl: row.cover_url,
      authorBps,
      volumeUi,
      feesUi: volumeUi * (authorBps / 10_000),
      trades: rows.length,
      chain: row.chain || "arc",
      tokenAddress: row.token_address ?? null,
    };
  });

  const holdMap = new Map<string, ProfileHold>();
  const fills: ProfileFill[] = [];
  const storyById = new Map(stories.map((row) => [row.id, row]));

  for (const trade of trades) {
    const story = storyById.get(trade.story_id);
    if (!story) continue;
    const decimals = Number(story.quote_decimals ?? 6);
    const q = quoteUi(trade.side, Number(trade.amount_in ?? 0), Number(trade.amount_out ?? 0), decimals);
    const t = tokensUi(trade.side, Number(trade.amount_in ?? 0), Number(trade.amount_out ?? 0));
    const trader = String(trade.trader ?? "").toLowerCase();
    const isSelf = Boolean(viewerId && viewerId === user.id);
    const mine = wallets.has(trader) || (isSelf && wallets.size === 0);
    if (mine) {
      fills.push({
        slug: story.slug,
        ticker: story.ticker,
        side: trade.side === "sell" ? "sell" : "buy",
        quoteUi: q,
        at: trade.traded_at,
        txHash: trade.tx_hash,
      });
      const hold = holdMap.get(story.slug) ?? {
        slug: story.slug,
        ticker: story.ticker,
        tokens: 0,
        spentUi: 0,
        receivedUi: 0,
      };
      if (trade.side === "sell") {
        hold.tokens -= t;
        hold.receivedUi += q;
      } else {
        hold.tokens += t;
        hold.spentUi += q;
      }
      holdMap.set(story.slug, hold);
    }
  }

  const holds = [...holdMap.values()].filter((row) => Math.abs(row.tokens) > 1e-6 || row.spentUi > 0);
  const volumeUi = launches.reduce((sum, row) => sum + row.volumeUi, 0);
  const feesUi = launches.reduce((sum, row) => sum + row.feesUi, 0);
  const tradedUi = fills.reduce((sum, row) => sum + row.quoteUi, 0);
  const bannerUrl = publicMediaUrl(x?.bannerUrl) || publicMediaUrl(user.banner_url) || "/brand/banner.jpg";

  return {
    id: user.id,
    handle: user.handle,
    displayName: x?.name || user.display_name || user.handle,
    bio: user.bio || x?.bio || "",
    portraitUrl:
      publicMediaUrl(x?.avatarUrl) ??
      hiResPortrait(user.portrait_url) ??
      publicMediaUrl(user.portrait_url) ??
      xAvatarFallback(user.handle) ??
      "/brand/logo.jpg",
    bannerUrl,
    launches,
    cards: [],
    holds,
    fills: fills.slice(0, 40),
    launchCount: launches.length,
    liveCount: launches.filter((row) => row.status === "live").length,
    graduatedCount: launches.filter((row) => row.status === "graduated").length,
    volumeUi,
    feesUi,
    tradedUi,
  };
}
