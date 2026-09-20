export const PRIMARY_QUOTES = ["sol", "usdc"] as const;
export type PrimaryQuoteId = (typeof PRIMARY_QUOTES)[number];

export const SECONDARY_QUOTES = ["sol", "usdc", "btc", "eth", "other"] as const;
export type QuoteAssetId = (typeof SECONDARY_QUOTES)[number];

export const LIQUIDITY_SOURCES = ["curve", "external", "existing", "custom"] as const;
export type LiquiditySourceId = (typeof LIQUIDITY_SOURCES)[number];

export type MarketRole = "primary" | "secondary";
export type MarketStatus = "ready" | "incomplete" | "not_configured";

export type PoolConfig = {
  tokenAllocation: string;
  pairedAmount: string;
};

export type LiquidityConfig = {
  source: LiquiditySourceId;
};

export type AdvancedMarketSettings = {
  slippageBps: number;
  priceInit: "auto" | "manual";
  lockEnabled: boolean;
  lockDays: number;
  routingPreference: "primary_first" | "best_price" | "manual";
  activation: "immediate" | "manual" | "on_target";
  secondaryActivation: "manual" | "after_primary" | "on_liquidity";
};

export type PrimaryMarket = {
  quote: PrimaryQuoteId;
  pool: PoolConfig;
  liquidity: LiquidityConfig;
  advanced: AdvancedMarketSettings;
};

export type SecondaryMarket = {
  id: string;
  quote: QuoteAssetId;
  customTicker: string;
  pool: PoolConfig;
};

export type MarketAccess = {
  primaryEnabled: boolean;
  secondaryEnabled: boolean;
  laterConnections: boolean;
};

export type MarketsConfig = {
  primary: PrimaryMarket;
  secondary: SecondaryMarket[];
  access: MarketAccess;
};

export type QuoteAsset = {
  id: QuoteAssetId;
  ticker: string;
  name: string;
  body: string;
  /** Display-only mock USD mark. Replace when a live oracle is wired. */
  mockUsd: number;
};

export const QUOTE_ASSETS: Record<QuoteAssetId, QuoteAsset> = {
  sol: { id: "sol", ticker: "SOL", name: "Solana", body: "Native SOL trading pair", mockUsd: 150 },
  usdc: { id: "usdc", ticker: "USDC", name: "USD Coin", body: "Stablecoin trading pair", mockUsd: 1 },
  btc: { id: "btc", ticker: "BTC", name: "Bitcoin", body: "Bitcoin market", mockUsd: 65_000 },
  eth: { id: "eth", ticker: "ETH", name: "Ether", body: "Ether market", mockUsd: 3_500 },
  other: { id: "other", ticker: "OTHER", name: "Other asset", body: "Custom supported asset", mockUsd: 1 },
};

export const LIQUIDITY_SOURCE_META: Record<LiquiditySourceId, { title: string; body: string }> = {
  curve: {
    title: "Custom bonding curve",
    body: "Opens automatically at launch. Virtual reserves look like a full book; real quote starts at zero. Buyers fund the curve. Neither OrbitX nor the creator deposits LP.",
  },
  external: {
    title: "External Pool",
    body: "Recorded only. The primary book is still the custom bonding curve, then a real DEX pool at graduation from buyer funds.",
  },
  existing: {
    title: "Existing Liquidity",
    body: "Recorded only. Canonical funded quote books are linked automatically. Nobody deposits LP at print.",
  },
  custom: {
    title: "Custom",
    body: "Recorded only. Quote liquidity is not pulled from OrbitX or the creator desk.",
  },
};

export type PoolEstimate = {
  tokenAmount: number;
  pairedAmount: number;
  pairedUsd: number;
  initialPrice: number;
  liquidityUsd: number;
  ratio: number;
  marketCapUsd: number;
  /** Mock constant-product impact of a $100 buy. UI only. */
  impactBps: number;
  valid: boolean;
  error?: string;
};

export function createPoolConfig(quote: QuoteAssetId = "sol"): PoolConfig {
  return {
    tokenAllocation: "800000000",
    pairedAmount: quote === "usdc" ? "0" : "0",
  };
}

export function createAdvancedMarketSettings(): AdvancedMarketSettings {
  return {
    slippageBps: 100,
    priceInit: "auto",
    lockEnabled: false,
    lockDays: 90,
    routingPreference: "primary_first",
    activation: "immediate",
    secondaryActivation: "manual",
  };
}

export function createMarketsConfig(): MarketsConfig {
  return {
    primary: {
      quote: "sol",
      pool: createPoolConfig("sol"),
      liquidity: { source: "curve" },
      advanced: createAdvancedMarketSettings(),
    },
    secondary: [],
    access: {
      primaryEnabled: true,
      secondaryEnabled: true,
      laterConnections: true,
    },
  };
}

export function parseAmount(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return NaN;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

export function tokenTicker(symbol: string) {
  const clean = symbol.trim().toUpperCase();
  return clean ? `$${clean}` : "$TOKEN";
}

export function quoteTicker(quote: QuoteAssetId, customTicker = "") {
  if (quote === "other") {
    const ticker = customTicker.trim().toUpperCase();
    return ticker || "OTHER";
  }
  return QUOTE_ASSETS[quote].ticker;
}

export function pairLabel(symbol: string, quote: QuoteAssetId, customTicker = "") {
  return `${tokenTicker(symbol)} / ${quoteTicker(quote, customTicker)}`;
}

export function estimatePool(
  pool: PoolConfig,
  quote: QuoteAssetId,
  totalSupply: string,
  customTicker = "",
): PoolEstimate {
  const tokenAmount = parseAmount(pool.tokenAllocation);
  const pairedAmount = parseAmount(pool.pairedAmount);
  const mark = QUOTE_ASSETS[quote].mockUsd;
  const supply = parseAmount(totalSupply);

  if (!(tokenAmount > 0)) {
    return {
      tokenAmount: Number.isFinite(tokenAmount) ? tokenAmount : 0,
      pairedAmount: Number.isFinite(pairedAmount) ? pairedAmount : 0,
      pairedUsd: 0,
      initialPrice: 0,
      liquidityUsd: 0,
      ratio: 0,
      marketCapUsd: 0,
      impactBps: 0,
      valid: false,
      error: "Enter a valid token allocation for the curve.",
    };
  }

  const virtualPaired = pairedAmount > 0 ? pairedAmount : 0;
  const pairedUsd = virtualPaired * mark;
  const initialPrice = tokenAmount > 0 && pairedUsd > 0 ? pairedUsd / tokenAmount : 0;
  const liquidityUsd = pairedUsd * 2;
  const marketCapUsd = supply > 0 && initialPrice > 0 ? supply * initialPrice : 0;
  const quoteIn = mark > 0 ? 100 / mark : 0;
  const newPaired = virtualPaired + quoteIn;
  const newToken = newPaired > 0 && virtualPaired > 0 ? (tokenAmount * virtualPaired) / newPaired : tokenAmount;
  const newPrice = newToken > 0 && newPaired > 0 ? (newPaired * mark) / newToken : initialPrice;
  const impactBps = initialPrice > 0 ? Math.round(((newPrice - initialPrice) / initialPrice) * 10_000) : 0;

  return {
    tokenAmount,
    pairedAmount: virtualPaired,
    pairedUsd,
    initialPrice,
    liquidityUsd,
    ratio: virtualPaired > 0 ? tokenAmount / virtualPaired : 0,
    marketCapUsd,
    impactBps,
    valid: true,
    error: quote === "other" && !customTicker.trim() ? "Name the custom quote asset." : undefined,
  };
}

export function marketStatus(estimate: PoolEstimate): MarketStatus {
  if (!estimate.tokenAmount && !estimate.pairedAmount) return "not_configured";
  return estimate.valid && !estimate.error ? "ready" : "incomplete";
}

export function formatEstimateUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toPrecision(3)}`;
}

export function formatEstimatePrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  const fixed = value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return `$${fixed}`;
}

export function formatRatio(tokenAmount: number, pairedAmount: number, quoteLabel: string) {
  if (!(tokenAmount > 0) || !(pairedAmount > 0)) return "—";
  const tokensPerQuote = tokenAmount / pairedAmount;
  return `${tokensPerQuote.toLocaleString("en-US", { maximumFractionDigits: 2 })} / 1 ${quoteLabel}`;
}

export function resolvedPrimaryPool(markets: MarketsConfig): PoolConfig {
  return { ...markets.primary.pool, pairedAmount: "0" };
}

export function primaryEstimate(markets: MarketsConfig, totalSupply: string) {
  const supply = parseAmount(totalSupply);
  const quote = markets.primary.quote;
  const mark = QUOTE_ASSETS[quote].mockUsd;
  const startCapUi = quote === "usdc" ? 3_000 : 30;
  const virtualBaseUi = supply > 0 ? (supply * 1.073) : 1_073_000_000;
  const virtualQuoteUi = supply > 0 ? (startCapUi * virtualBaseUi) / supply : startCapUi;
  const tradable = supply > 0 ? supply * 0.8 : 0;
  const startPrice = virtualBaseUi > 0 ? (virtualQuoteUi / virtualBaseUi) * mark : 0;
  const quoteIn = mark > 0 ? 100 / mark : 0;
  const newQuote = virtualQuoteUi + quoteIn;
  const newBase = newQuote > 0 ? (virtualBaseUi * virtualQuoteUi) / newQuote : virtualBaseUi;
  const newPrice = newBase > 0 ? (newQuote / newBase) * mark : startPrice;
  const impactBps = startPrice > 0 ? Math.round(((newPrice - startPrice) / startPrice) * 10_000) : 0;
  return {
    tokenAmount: tradable,
    pairedAmount: virtualQuoteUi,
    pairedUsd: virtualQuoteUi * mark,
    initialPrice: startPrice,
    liquidityUsd: virtualQuoteUi * mark,
    ratio: virtualQuoteUi > 0 ? tradable / virtualQuoteUi : 0,
    marketCapUsd: supply > 0 ? supply * startPrice : 0,
    impactBps,
    valid: supply > 0,
    error: undefined,
  } satisfies PoolEstimate;
}

export function primaryMarketComplete(markets: MarketsConfig, totalSupply = "1000000000") {
  return !primaryMarketError(markets, totalSupply);
}

export function primaryMarketError(markets: MarketsConfig, totalSupply = "1000000000") {
  if (!markets.primary.quote || !markets.access.primaryEnabled) {
    return "Select a primary market to continue.";
  }
  const supply = parseAmount(totalSupply);
  if (!(supply > 0)) return "Set a token supply before opening the curve.";
  return undefined;
}

export function liquidityAllocationPct(tokenAllocation: string, totalSupply: string) {
  const allocated = parseAmount(tokenAllocation);
  const supply = parseAmount(totalSupply);
  if (!(allocated > 0) || !(supply > 0)) return 0;
  return Math.min(100, (allocated / supply) * 100);
}

export function marketTickers(markets: MarketsConfig) {
  return [
    quoteTicker(markets.primary.quote),
    ...markets.secondary.map((row) => quoteTicker(row.quote, row.customTicker)),
  ].filter(Boolean);
}

export function tickerConflicts(markets: MarketsConfig, ticker: string, ignoreId?: string) {
  const clean = ticker.trim().toUpperCase();
  if (!clean) return false;
  if (quoteTicker(markets.primary.quote) === clean) return true;
  return markets.secondary.some(
    (row) => row.id !== ignoreId && quoteTicker(row.quote, row.customTicker) === clean,
  );
}

export function secondaryMarketError(market: SecondaryMarket, siblings: SecondaryMarket[], primary: PrimaryQuoteId) {
  const ticker = quoteTicker(market.quote, market.customTicker);
  if (market.quote === primary || ticker === QUOTE_ASSETS[primary].ticker) {
    return "That market has already been added.";
  }
  if (market.quote !== "other" && siblings.filter((row) => row.quote === market.quote).length > 1) {
    return "That market has already been added.";
  }
  if (market.quote === "other") {
    if (!market.customTicker.trim()) return "Name the custom quote asset.";
    const sameTicker = siblings.filter(
      (row) => row.id !== market.id && quoteTicker(row.quote, row.customTicker) === ticker,
    );
    if (sameTicker.length > 0) return "That market has already been added.";
  }
  return ticker ? undefined : "Complete this market or remove it.";
}

export function secondaryMarketsComplete(markets: MarketsConfig) {
  if (!markets.access.secondaryEnabled) return markets.secondary.length === 0;
  return markets.secondary.every((row) => !secondaryMarketError(row, markets.secondary, markets.primary.quote));
}

export function marketsComplete(markets: MarketsConfig, totalSupply: string) {
  return primaryMarketComplete(markets, totalSupply) && secondaryMarketsComplete(markets);
}

export function configuredMarketCount(markets: MarketsConfig, totalSupply: string) {
  const primary = primaryMarketComplete(markets, totalSupply) ? 1 : 0;
  const secondary = markets.secondary.filter((row) => !secondaryMarketError(row, markets.secondary, markets.primary.quote)).length;
  return primary + secondary;
}

export function availableSecondaryQuotes(markets: MarketsConfig): QuoteAssetId[] {
  return SECONDARY_QUOTES.filter((id) => {
    if (id === markets.primary.quote) return false;
    if (id === "other") return true;
    return !markets.secondary.some((row) => row.quote === id);
  });
}

export function createSecondaryMarket(quote: QuoteAssetId, customTicker = ""): SecondaryMarket {
  return {
    id: `mkt-${quote}-${Math.random().toString(36).slice(2, 8)}`,
    quote,
    customTicker,
    pool: createPoolConfig(quote),
  };
}

export function isPrimaryQuoteId(value: unknown): value is PrimaryQuoteId {
  return value === "sol" || value === "usdc";
}

export function isQuoteAssetId(value: unknown): value is QuoteAssetId {
  return SECONDARY_QUOTES.includes(value as QuoteAssetId);
}

export function isLiquiditySourceId(value: unknown): value is LiquiditySourceId {
  return LIQUIDITY_SOURCES.includes(value as LiquiditySourceId);
}
