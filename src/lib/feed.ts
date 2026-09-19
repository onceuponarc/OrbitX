import { chapterStartPriceUi, virtualQuoteUiFor } from "@onceupon/config/chapter";
import type { LocalArcStory } from "@/lib/arc/store";
import { OFFICIAL_TOKEN } from "@/lib/official-token";

export type FeedLaunch = {
  slug: string;
  title: string;
  ticker: string;
  blurb: string;
  engine: "author" | "onceuponers";
  pairLabel: string;
  authorBps: number;
  status: "draft" | "live" | "graduated" | "paused" | "archived";
  coverUrl: string | null;
  handle: string | null;
  createdAt: string;
  chain?: string;
  venue?: string;
  tokenAddress?: string | null;
  quoteAddress?: string | null;
  priceUi: number;
  changePct: number;
  volumeUi: number;
  volumeDayUsd: number;
  volumeWeekUsd: number;
  volumeTotalUsd: number;
  holders: number;
  spark: number[];
  mcapUi: number;
  progressBps: number;
  lastSide?: "buy" | "sell";
};

export type TapeItem = {
  slug: string;
  ticker: string;
  side: "buy" | "sell";
  quoteUi: number;
  trader: string;
  at: string;
  txHash?: string;
};

export type FeedTab = "new" | "trending" | "curve" | "bonded";

export const FEED_TABS: { id: FeedTab; label: string; hint: string }[] = [
  { id: "new", label: "New", hint: "Just launched. First fills print on the tape." },
  { id: "trending", label: "Trending", hint: "Highest volume on the pad right now." },
  { id: "curve", label: "Graduating", hint: "Still on the curve. Watch progress to the pool." },
  { id: "bonded", label: "Graduated", hint: "Cleared the curve. Pool is open." },
];

export function filterFeed(launches: FeedLaunch[], tab: FeedTab): FeedLaunch[] {
  const live = launches.filter((item) => item.status === "live");
  const bonded = launches.filter((item) => item.status === "graduated");
  const byNew = [...launches]
    .filter((item) => item.status === "live" || item.status === "graduated")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  switch (tab) {
    case "new":
      return pinOfficialFirst(byNew);
    case "trending":
      return pinOfficialFirst(
        [...launches]
          .filter((item) => item.status === "live" || item.status === "graduated")
          .sort(
            (a, b) =>
              (b.volumeDayUsd || b.volumeUi) - (a.volumeDayUsd || a.volumeUi) ||
              +new Date(b.createdAt) - +new Date(a.createdAt),
          ),
      );
    case "curve":
      return pinOfficialFirst([...live].sort((a, b) => b.progressBps - a.progressBps));
    case "bonded":
      return pinOfficialFirst(bonded);
    default:
      return pinOfficialFirst(byNew);
  }
}

const ANVIL_QUOTE = "0x5fc8d32690cc91d4c39d9d3abcbd16989f875707";
export const OFFICIAL_LAUNCH_SLUG = "orbitx";

// Agent/demo coins from pad testing. New public launches are not in this set.
const HIDDEN_TEST_LAUNCH_SLUGS = new Set([
  "elon-musk-zrgf",
  "paid-s9ty",
  "trollpepe-zn4y",
  "volt-hrrb",
  "rune-kuou",
  "edge-u7iw",
  "arccat-ruyy",
  "aro-7lbr",
  "cursor-agent-p29a",
  "eth-cat-8c3y",
  "grok-3b8q",
  "cagt-z02y",
]);

const HIDDEN_TEST_TICKERS = new Set([
  "DEMO",
  "MOCK",
  "FOO",
  "BAR",
  "TEST",
  "CAGT",
  "ETHCAT",
  "ARO",
  "GROK",
  "AROCAT",
  "ARCCAT",
  "PAID",
  "TPEPE",
  "TROLLPEPE",
  "ELON",
  "ELONMUSK",
]);

function normTicker(ticker: string): string {
  return ticker.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function isOfficialLaunch(item: {
  slug?: string | null;
  ticker?: string | null;
  tokenAddress?: string | null;
}): boolean {
  if ((item.tokenAddress ?? "") === OFFICIAL_TOKEN.mint) return true;
  if ((item.slug ?? "").toLowerCase() === OFFICIAL_LAUNCH_SLUG) return true;
  return normTicker(item.ticker ?? "") === "ORBITX";
}

export function pinOfficialFirst<T extends { slug?: string | null; ticker?: string | null; tokenAddress?: string | null }>(
  rows: T[],
): T[] {
  const official = rows.filter((row) => isOfficialLaunch(row));
  const rest = rows.filter((row) => !isOfficialLaunch(row));
  return official.length ? [...official, ...rest] : rows;
}

export function isHiddenTestLaunch(item: {
  slug?: string | null;
  ticker?: string | null;
  quoteAddress?: string | null;
  tokenAddress?: string | null;
}): boolean {
  if (isOfficialLaunch(item)) return false;
  const slug = (item.slug ?? "").toLowerCase();
  if (HIDDEN_TEST_LAUNCH_SLUGS.has(slug)) return true;
  if (slug.startsWith("cursor-agent-") || slug.startsWith("elon-musk-")) return true;
  const ticker = normTicker(item.ticker ?? "");
  if (HIDDEN_TEST_TICKERS.has(ticker)) return true;
  const quote = (item.quoteAddress ?? "").toLowerCase();
  return quote === ANVIL_QUOTE;
}

export function isAnvilLaunch(item: {
  slug?: string | null;
  quoteAddress?: string | null;
  tokenAddress?: string | null;
  ticker?: string | null;
}): boolean {
  return isHiddenTestLaunch(item);
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function hasValidTokenAddress(chain: string, mint: string): boolean {
  if (!mint) return false;
  if (chain === "solana") return SOLANA_ADDRESS.test(mint);
  return EVM_ADDRESS.test(mint);
}

export function isListedLaunch(item: FeedLaunch & { quoteAddress?: string | null }): boolean {
  if (isOfficialLaunch(item)) return item.status === "live" || item.status === "graduated";
  if (isHiddenTestLaunch(item)) return false;
  const chain = item.chain ?? "arc";
  const mint = item.tokenAddress ?? "";
  if (!hasValidTokenAddress(chain, mint)) return false;
  const ticker = item.ticker.trim().toUpperCase();
  if (["DEMO", "MOCK", "FOO", "BAR"].includes(ticker)) return false;
  return item.status === "live" || item.status === "graduated";
}

/** 0.5 volume + 0.3 unique holders + 0.2 curve progress. */
export function deskScore(launch: FeedLaunch): number {
  const vol = Math.log10(1 + Math.max(0, launch.volumeUi));
  const crowd = Math.log10(1 + Math.max(0, launch.holders));
  const curve = Math.min(1, Math.max(0, launch.progressBps / 10_000));
  return 0.5 * vol + 0.3 * crowd + 0.2 * curve * 3;
}

export function tokenOfTheDay(launches: FeedLaunch[]): FeedLaunch | null {
  const listed = launches.filter(isListedLaunch);
  if (!listed.length) return null;
  const official = listed.find((row) => isOfficialLaunch(row));
  if (official) return official;
  return (
    [...listed].sort(
      (a, b) => deskScore(b) - deskScore(a) || b.volumeUi - a.volumeUi || +new Date(b.createdAt) - +new Date(a.createdAt),
    )[0] ?? null
  );
}

export function weekBoard(launches: FeedLaunch[]): FeedLaunch[] {
  const listed = launches.filter(isListedLaunch);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const official = listed.filter((row) => isOfficialLaunch(row));
  const recent = listed.filter((row) => !isOfficialLaunch(row) && +new Date(row.createdAt) >= weekAgo);
  const rest = recent.length ? recent : listed.filter((row) => !isOfficialLaunch(row));
  return pinOfficialFirst([...official, ...rest].sort((a, b) => deskScore(b) - deskScore(a))).slice(0, 8);
}

export function tickerHue(ticker: string): number {
  let hash = 0;
  for (const char of ticker) hash = (hash * 33 + char.charCodeAt(0)) % 360;
  return hash;
}

export function launchChainLabel(chain: string | undefined): string {
  if (chain === "solana") return "Solana";
  if (chain === "robinhood") return "Robinhood";
  return "Arc";
}

/** Where a token row should send people. Arc trades in-app; Solana and Robinhood
 *  Chain tokens trade on their native venue, so those go external. */
export function launchHref(launch: Pick<FeedLaunch, "slug" | "chain" | "tokenAddress" | "ticker">): {
  href: string;
  external: boolean;
} {
  if (isOfficialLaunch(launch)) return { href: "/params", external: false };
  return { href: `/story/${launch.slug}`, external: false };
}

export function launchTradeHref(
  launch: Pick<FeedLaunch, "slug" | "chain" | "tokenAddress" | "ticker">,
): string {
  if (isOfficialLaunch(launch)) return `/trade?mint=${OFFICIAL_TOKEN.mint}&symbol=ORBITX`;
  if (launch.chain === "solana" && launch.tokenAddress) {
    return `/trade?mint=${launch.tokenAddress}&symbol=${encodeURIComponent(launch.ticker)}`;
  }
  return `/story/${launch.slug}?buy=1`;
}

/** Flagship $ORBITX row for the public board. Price/volume get overlaid from DexScreener. */
export function officialFeedLaunch(): FeedLaunch {
  return {
    slug: OFFICIAL_LAUNCH_SLUG,
    title: OFFICIAL_TOKEN.name,
    ticker: OFFICIAL_TOKEN.ticker,
    blurb: "Official OrbitX token. Live on Solana.",
    engine: "onceuponers",
    pairLabel: "ORBITX/SOL",
    authorBps: 0,
    status: "live",
    coverUrl: "/brand/logo.jpg",
    handle: "orbitx_wrld",
    createdAt: "2026-08-10T11:59:54.000Z",
    chain: "solana",
    venue: "pumpfun",
    tokenAddress: OFFICIAL_TOKEN.mint,
    quoteAddress: "So11111111111111111111111111111111111111112",
    priceUi: 0,
    changePct: 0,
    volumeUi: 0,
    volumeDayUsd: 0,
    volumeWeekUsd: 0,
    volumeTotalUsd: 0,
    holders: 0,
    spark: [0.00003, 0.000032, 0.000031, 0.000034, 0.000035],
    mcapUi: 0,
    progressBps: 10_000,
  };
}

export type RawTrade = {
  storyId?: string;
  slug?: string;
  side: string;
  amountIn: number;
  amountOut: number;
  quoteDecimals: number;
  baseDecimals: number;
  trader: string;
  at: string;
  priceUsd?: number | null;
};

function startPrice(pairLabel: string): number {
  if (pairLabel.toUpperCase().includes("USD")) {
    return chapterStartPriceUi(virtualQuoteUiFor(), 1_073_000_000);
  }
  return 0.00003;
}

function sparkFrom(prices: number[], fallback: number): number[] {
  if (prices.length >= 2) return prices.slice(-24);
  if (prices.length === 1) return [fallback, prices[0]];
  const seed = fallback || 0.00001;
  return Array.from({ length: 8 }, (_, i) => seed * (1 + i * 0.004));
}

function tradeUsd(trade: RawTrade, pairLabel: string): number {
  const quoteDec = trade.quoteDecimals || 6;
  const quoteUi =
    trade.side === "buy" ? trade.amountIn / 10 ** quoteDec : trade.amountOut / 10 ** quoteDec;
  const baseDec = trade.baseDecimals || 6;
  const tokensUi =
    trade.side === "buy" ? trade.amountOut / 10 ** baseDec : trade.amountIn / 10 ** baseDec;
  if (trade.priceUsd && tokensUi > 0) return tokensUi * trade.priceUsd;
  if (pairLabel.toUpperCase().includes("USD")) return quoteUi;
  return quoteUi;
}

export function enrichLaunch(
  base: Omit<
    FeedLaunch,
    | "priceUi"
    | "changePct"
    | "volumeUi"
    | "volumeDayUsd"
    | "volumeWeekUsd"
    | "volumeTotalUsd"
    | "holders"
    | "spark"
    | "mcapUi"
    | "progressBps"
  > &
    Partial<
      Pick<
        FeedLaunch,
        | "priceUi"
        | "changePct"
        | "volumeUi"
        | "volumeDayUsd"
        | "volumeWeekUsd"
        | "volumeTotalUsd"
        | "holders"
        | "spark"
        | "mcapUi"
        | "progressBps"
      >
    >,
  trades: RawTrade[],
  opts?: { curveQuoteUi?: number; graduateUi?: number; supplyUi?: number },
): FeedLaunch {
  const fallback = startPrice(base.pairLabel);
  const prices: number[] = [];
  let volume = 0;
  let volumeDayUsd = 0;
  let volumeWeekUsd = 0;
  let volumeTotalUsd = 0;
  const holders = new Set<string>();
  let lastSide: "buy" | "sell" | undefined;
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  for (const trade of trades) {
    const quoteDec = trade.quoteDecimals || 6;
    const quoteUi =
      trade.side === "buy" ? trade.amountIn / 10 ** quoteDec : trade.amountOut / 10 ** quoteDec;
    const baseDec = trade.baseDecimals || 6;
    const tokensUi =
      trade.side === "buy" ? trade.amountOut / 10 ** baseDec : trade.amountIn / 10 ** baseDec;
    const price = trade.priceUsd || (tokensUi > 0 ? quoteUi / tokensUi : 0);
    if (price > 0) prices.push(price);
    volume += quoteUi;
    const usd = tradeUsd(trade, base.pairLabel);
    volumeTotalUsd += usd;
    const at = +new Date(trade.at);
    if (Number.isFinite(at) && at >= weekAgo) volumeWeekUsd += usd;
    if (Number.isFinite(at) && at >= dayAgo) volumeDayUsd += usd;
    if (trade.trader) holders.add(trade.trader);
    lastSide = trade.side === "sell" ? "sell" : "buy";
  }
  const price = prices.at(-1) ?? fallback;
  const first = prices[0] ?? price;
  const changePct = first ? ((price - first) / first) * 100 : 0;
  const supply = opts?.supplyUi ?? 1_000_000_000;
  const graduate = opts?.graduateUi ?? (base.pairLabel.toUpperCase().includes("USD") ? 5000 : 2);
  const raised = opts?.curveQuoteUi ?? 0;
  const volumeUi = volumeDayUsd || volumeTotalUsd || volume;
  return {
    ...base,
    priceUi: price,
    changePct,
    volumeUi,
    volumeDayUsd,
    volumeWeekUsd: Math.max(volumeWeekUsd, volumeDayUsd),
    volumeTotalUsd: Math.max(volumeTotalUsd, volumeWeekUsd, volumeDayUsd),
    holders: holders.size,
    spark: sparkFrom(prices, fallback),
    mcapUi: price * supply * 0.000001 * 1_000_000, // keep finite; display uses price * implied float
    progressBps: graduate > 0 ? Math.min(10_000, Math.round((raised / graduate) * 10_000)) : 0,
    lastSide,
  };
}

export function feedFromArc(story: LocalArcStory): FeedLaunch {
  const trades: RawTrade[] = story.trades.map((trade) => ({
    side: trade.side,
    amountIn: Number(trade.amountIn),
    amountOut: Number(trade.amountOut),
    quoteDecimals: 6,
    baseDecimals: 18,
    trader: trade.trader,
    at: trade.tradedAt,
    priceUsd: trade.priceUsd,
  }));
  return enrichLaunch(
    {
      slug: story.slug,
      title: story.title,
      ticker: story.ticker,
      blurb: story.blurb,
      engine: story.engine,
      pairLabel: story.pairLabel,
      authorBps: story.authorBps,
      status: story.status,
      coverUrl: story.coverUrl,
      handle: story.handle,
      createdAt: story.createdAt,
      chain: "arc",
      venue: "spl",
      tokenAddress: story.tokenAddress,
    },
    trades,
    {
      curveQuoteUi: Number(story.curveQuoteRaw) / 1e6,
      graduateUi: Number(story.graduationQuoteRaw) / 1e6,
      supplyUi: 1_000_000_000,
    },
  );
}
