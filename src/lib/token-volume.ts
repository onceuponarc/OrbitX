/** On-chain token volume for pad stats. DexScreener supplies rolling 24h;
 *  GeckoTerminal pool candles fill in 7d and lifetime. Local desk fills are
 *  only a fallback when a mint has no indexed pairs yet. */

export type TokenMarketVolume = {
  dayUsd: number;
  weekUsd: number;
  totalUsd: number;
  priceUsd: number | null;
  changePct: number | null;
  mcapUsd: number | null;
  pairAddress: string | null;
  network: string;
};

export type PadVolume = {
  dayUsd: number;
  weekUsd: number;
  totalUsd: number;
};

export type DexPairVolume = {
  chainId?: string;
  pairAddress?: string;
  dexId?: string;
  priceUsd?: string | number;
  priceChange?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number | string; h6?: number | string; h1?: number | string };
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
};

const DEX_CHAIN: Record<string, string> = {
  solana: "solana",
  robinhood: "robinhood",
  arc: "arc",
};

const GECKO_NETWORK: Record<string, string> = {
  solana: "solana",
  robinhood: "robinhood",
  arc: "arc",
};

const DEX_SCREENER = "https://api.dexscreener.com";
const GECKO = "https://api.geckoterminal.com/api/v2";
const UA = { accept: "application/json", "user-agent": "OrbitX/1.0" };
const DEX_TTL_MS = 45_000;
const OHLCV_TTL_MS = 120_000;
const DEX_BATCH = 30;

type CacheEntry<T> = { value: T; ts: number };
const dexCache = new Map<string, CacheEntry<TokenMarketVolume>>();
const ohlcvCache = new Map<string, CacheEntry<number[][]>>();

export function volumeKey(chain: string, mint: string): string {
  const c = (chain || "solana").toLowerCase();
  const trimmed = mint.trim();
  const m = trimmed.startsWith("0x") ? trimmed.toLowerCase() : trimmed;
  return `${c}:${m}`;
}

export function geckoNetworkFor(chain: string): string {
  return GECKO_NETWORK[chain] ?? chain;
}

function dexChainFor(chain: string): string {
  return DEX_CHAIN[chain] ?? chain;
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function involvesMint(pair: DexPairVolume, mint: string): boolean {
  const want = mint.startsWith("0x") ? mint.toLowerCase() : mint;
  const base = pair.baseToken?.address ?? "";
  const quote = pair.quoteToken?.address ?? "";
  const baseN = base.startsWith("0x") ? base.toLowerCase() : base;
  const quoteN = quote.startsWith("0x") ? quote.toLowerCase() : quote;
  return Boolean(want) && (baseN === want || quoteN === want);
}

function chainMatches(pair: DexPairVolume, chain: string): boolean {
  const expected = dexChainFor(chain).toLowerCase();
  const id = (pair.chainId ?? "").toLowerCase();
  if (!id || !expected) return true;
  return id === expected || id.includes(expected);
}

export function emptyVolume(chain = "solana"): TokenMarketVolume {
  return {
    dayUsd: 0,
    weekUsd: 0,
    totalUsd: 0,
    priceUsd: null,
    changePct: null,
    mcapUsd: null,
    pairAddress: null,
    network: geckoNetworkFor(chain),
  };
}

export function floorWindows(volume: Pick<PadVolume, "dayUsd" | "weekUsd" | "totalUsd">): PadVolume {
  const dayUsd = Math.max(0, volume.dayUsd);
  const weekUsd = Math.max(0, volume.weekUsd, dayUsd);
  const totalUsd = Math.max(0, volume.totalUsd, weekUsd);
  return { dayUsd, weekUsd, totalUsd };
}

/** Sum DexScreener pairs for one mint into rolling-24h stats. Week/total start
 *  as the 24h floor until candle history is merged. */
export function aggregateDexPairs(mint: string, chain: string, pairs: DexPairVolume[]): TokenMarketVolume {
  const involved = pairs.filter((pair) => involvesMint(pair, mint));
  const matched = involved.filter((pair) => chainMatches(pair, chain));
  const use = matched.length ? matched : involved;
  const out = emptyVolume(chain);
  if (!use.length) return out;

  let bestLiq = -1;
  for (const pair of use) {
    out.dayUsd += num(pair.volume?.h24);
    const liq = num(pair.liquidity?.usd);
    if (liq >= bestLiq) {
      bestLiq = liq;
      out.pairAddress = pair.pairAddress ?? out.pairAddress;
      const price = Number(pair.priceUsd);
      out.priceUsd = Number.isFinite(price) && price > 0 ? price : out.priceUsd;
      const change = pair.priceChange?.h24;
      out.changePct = typeof change === "number" && Number.isFinite(change) ? change : out.changePct;
      const mcap = num(pair.marketCap) || num(pair.fdv);
      out.mcapUsd = mcap || out.mcapUsd;
    }
  }
  return { ...out, ...floorWindows({ dayUsd: out.dayUsd, weekUsd: out.dayUsd, totalUsd: out.dayUsd }) };
}

/** Gecko OHLCV rows are `[ts, o, h, l, c, volumeUsd]`, newest first. */
export function mergeOhlcv(
  market: TokenMarketVolume,
  candles: number[][],
  nowSec = Date.now() / 1000,
): TokenMarketVolume {
  const weekAgo = nowSec - 7 * 24 * 60 * 60;
  let week = 0;
  let total = 0;
  for (const row of candles) {
    const ts = Number(row?.[0]);
    const vol = Number(row?.[5] ?? 0);
    if (!Number.isFinite(vol) || vol <= 0) continue;
    total += vol;
    if (Number.isFinite(ts) && ts >= weekAgo) week += vol;
  }
  return { ...market, ...floorWindows({ dayUsd: market.dayUsd, weekUsd: week, totalUsd: total }) };
}

export function overlayLaunchVolume<
  T extends {
    volumeUi: number;
    volumeDayUsd?: number;
    volumeWeekUsd?: number;
    volumeTotalUsd?: number;
    priceUi: number;
    changePct: number;
    mcapUi: number;
  },
>(launch: T, market: TokenMarketVolume | null | undefined): T {
  if (!market) return launch;
  const localDay = launch.volumeDayUsd ?? 0;
  const localWeek = launch.volumeWeekUsd ?? launch.volumeUi ?? 0;
  const localTotal = launch.volumeTotalUsd ?? launch.volumeUi ?? 0;
  const windows = floorWindows({
    dayUsd: market.dayUsd || localDay,
    weekUsd: market.weekUsd || localWeek,
    totalUsd: market.totalUsd || localTotal,
  });
  const hasMarket = market.dayUsd > 0 || market.weekUsd > 0 || market.totalUsd > 0;
  return {
    ...launch,
    volumeDayUsd: windows.dayUsd,
    volumeWeekUsd: windows.weekUsd,
    volumeTotalUsd: windows.totalUsd,
    volumeUi: windows.dayUsd || windows.totalUsd || launch.volumeUi,
    priceUi: market.priceUsd && market.priceUsd > 0 ? market.priceUsd : launch.priceUi,
    changePct: hasMarket && market.changePct != null ? market.changePct : launch.changePct,
    mcapUi: market.mcapUsd && market.mcapUsd > 0 ? market.mcapUsd : launch.mcapUi,
  };
}

export function sumPadVolume(
  launches: Array<{ volumeDayUsd?: number; volumeWeekUsd?: number; volumeTotalUsd?: number; volumeUi?: number }>,
  extra?: PadVolume | null,
): PadVolume {
  let dayUsd = 0;
  let weekUsd = 0;
  let totalUsd = 0;
  for (const row of launches) {
    dayUsd += row.volumeDayUsd ?? 0;
    weekUsd += row.volumeWeekUsd ?? row.volumeUi ?? 0;
    totalUsd += row.volumeTotalUsd ?? row.volumeUi ?? 0;
  }
  if (extra) {
    dayUsd += extra.dayUsd;
    weekUsd += extra.weekUsd;
    totalUsd += extra.totalUsd;
  }
  return floorWindows({ dayUsd, weekUsd, totalUsd });
}

function timeoutSignal(ms: number) {
  return AbortSignal.timeout(ms);
}

function pairsFromBody(body: unknown): DexPairVolume[] {
  if (Array.isArray(body)) return body as DexPairVolume[];
  if (body && typeof body === "object" && Array.isArray((body as { pairs?: DexPairVolume[] }).pairs)) {
    return (body as { pairs: DexPairVolume[] }).pairs;
  }
  return [];
}

async function fetchJson(url: string, ms = 5000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: timeoutSignal(ms),
      cache: "no-store",
      headers: UA,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

async function fetchDexBatch(mints: string[]): Promise<Map<string, DexPairVolume[]>> {
  const grouped = new Map<string, DexPairVolume[]>();
  if (!mints.length) return grouped;
  const batch = pairsFromBody(await fetchJson(`${DEX_SCREENER}/latest/dex/tokens/${mints.join(",")}`));
  for (const mint of mints) {
    const hits = batch.filter((pair) => involvesMint(pair, mint));
    if (hits.length) grouped.set(mint, hits);
  }
  const missing = mints.filter((mint) => !grouped.has(mint));
  if (!missing.length) return grouped;
  await mapPool(missing.slice(0, 8), 4, async (mint) => {
    const pairs = pairsFromBody(await fetchJson(`${DEX_SCREENER}/latest/dex/tokens/${mint}`));
    if (pairs.length) grouped.set(mint, pairs);
  });
  return grouped;
}

async function fetchDexForToken(chain: string, mint: string): Promise<DexPairVolume[]> {
  const slug = dexChainFor(chain);
  const urls = [`${DEX_SCREENER}/token-pairs/v1/${slug}/${mint}`, `${DEX_SCREENER}/latest/dex/tokens/${mint}`];
  for (const url of urls) {
    const pairs = pairsFromBody(await fetchJson(url));
    if (pairs.length) return pairs;
  }
  return [];
}

function ohlcvFromBody(body: unknown): number[][] {
  const list = (body as { data?: { attributes?: { ohlcv_list?: number[][] } } } | null)?.data?.attributes
    ?.ohlcv_list;
  return Array.isArray(list) ? list : [];
}

async function fetchPoolOhlcv(network: string, pool: string): Promise<number[][]> {
  const key = `${network}:${pool}`;
  const cached = ohlcvCache.get(key);
  if (cached && Date.now() - cached.ts < OHLCV_TTL_MS) return cached.value;
  const body = await fetchJson(
    `${GECKO}/networks/${network}/pools/${pool}/ohlcv/day?aggregate=1&limit=1000`,
    5_000,
  );
  const candles = ohlcvFromBody(body);
  ohlcvCache.set(key, { value: candles, ts: Date.now() });
  return candles;
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (!items.length) return;
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

export async function loadTokenVolumes(
  tokens: Array<{ chain: string; mint: string }>,
): Promise<Map<string, TokenMarketVolume>> {
  const out = new Map<string, TokenMarketVolume>();
  const unique: { chain: string; mint: string; key: string }[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (!token.mint) continue;
    const key = volumeKey(token.chain, token.mint);
    if (seen.has(key)) continue;
    seen.add(key);
    const cached = dexCache.get(key);
    if (cached && Date.now() - cached.ts < DEX_TTL_MS) {
      out.set(key, cached.value);
      continue;
    }
    unique.push({ chain: token.chain || "solana", mint: token.mint.trim(), key });
  }
  if (!unique.length) return out;

  for (let i = 0; i < unique.length; i += DEX_BATCH) {
    const chunk = unique.slice(i, i + DEX_BATCH);
    const grouped = await fetchDexBatch(chunk.map((row) => row.mint));
    for (const row of chunk) {
      const pairs = grouped.get(row.mint) ?? [];
      out.set(row.key, aggregateDexPairs(row.mint, row.chain, pairs));
    }
    const stillEmpty = chunk.filter((row) => !(grouped.get(row.mint) ?? []).length).slice(0, 6);
    await mapPool(stillEmpty, 3, async (row) => {
      const pairs = await fetchDexForToken(row.chain, row.mint);
      if (pairs.length) out.set(row.key, aggregateDexPairs(row.mint, row.chain, pairs));
    });
  }

  const needCandles = unique
    .filter((row) => {
      const market = out.get(row.key);
      return Boolean(market?.pairAddress) && ((market?.dayUsd ?? 0) > 0 || (market?.mcapUsd ?? 0) > 0);
    })
    .sort((a, b) => (out.get(b.key)?.dayUsd ?? 0) - (out.get(a.key)?.dayUsd ?? 0))
    .slice(0, 8);
  await mapPool(needCandles, 3, async (row) => {
    const market = out.get(row.key);
    if (!market?.pairAddress) return;
    const candles = await fetchPoolOhlcv(market.network, market.pairAddress);
    if (!candles.length) return;
    out.set(row.key, mergeOhlcv(market, candles));
  });

  for (const row of unique) {
    const market = out.get(row.key) ?? emptyVolume(row.chain);
    dexCache.set(row.key, { value: market, ts: Date.now() });
    out.set(row.key, market);
  }
  return out;
}
