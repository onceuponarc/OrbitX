import {
  CHAPTER,
  chapterStartPriceUi,
  lpBaseReservedUi,
  tradableUi,
  virtualBaseUiFor,
  virtualQuoteUiFor,
} from "@onceupon/config/chapter";
import { SOLANA } from "@onceupon/config/solana";
import { uiToRaw } from "@onceupon/config/quotes";
import { parseSupply } from "@/lib/custom-launch/token";
import { quoteChapterBuy, quoteChapterSell, type ChapterState } from "@/lib/solana/curve";

export type CurveQuote = "sol" | "usdc";

type CurveDraft = {
  token: { supply: string; decimals: number };
  markets: { primary: { quote: CurveQuote } };
};

export const CUSTOM_LAUNCH_CURVE = {
  tradableBps: CHAPTER.tradableBps,
  lpReservedBps: CHAPTER.lpReservedBps,
  maxFeeBps: 500,
} as const;

export type CustomLaunchCurvePreview = {
  supplyUi: number;
  quote: CurveQuote;
  quoteDecimals: number;
  startCapUi: number;
  graduateUi: number;
  virtualBaseUi: number;
  virtualQuoteUi: number;
  tradableUi: number;
  lpReservedUi: number;
  startPriceUi: number;
  realQuoteUi: number;
};

export type CustomLaunchCurveRaw = {
  virtualQuoteRaw: bigint;
  virtualBaseRaw: bigint;
  realQuoteRaw: bigint;
  realBaseRaw: bigint;
  lpReservedRaw: bigint;
  k: bigint;
  graduateTargetRaw: bigint;
  supplyRaw: bigint;
  quoteDecimals: number;
};

export function quoteDecimalsFor(quote: CurveQuote) {
  return quote === "usdc" ? 6 : 9;
}

export function curveCapsForQuote(quote: CurveQuote) {
  if (quote === "usdc") {
    return { startCapUi: CHAPTER.startCapQuoteUi, graduateUi: CHAPTER.graduateQuoteUi };
  }
  return { startCapUi: SOLANA.virtualQuoteSol, graduateUi: SOLANA.bondingGraduationSol };
}

export function customLaunchCurvePreview(draft: CurveDraft, realQuoteUi = 0): CustomLaunchCurvePreview {
  const supplyUi = Number(parseSupply(draft.token.supply));
  const quote = draft.markets.primary.quote;
  const { startCapUi, graduateUi } = curveCapsForQuote(quote);
  const virtualBase = virtualBaseUiFor(supplyUi > 0 ? supplyUi : CHAPTER.totalSupplyUi);
  const virtualQuote = virtualQuoteUiFor({
    startCapUi,
    virtualBaseUi: virtualBase,
    supplyUi: supplyUi > 0 ? supplyUi : CHAPTER.totalSupplyUi,
  });
  return {
    supplyUi,
    quote,
    quoteDecimals: quoteDecimalsFor(quote),
    startCapUi,
    graduateUi,
    virtualBaseUi: virtualBase,
    virtualQuoteUi: virtualQuote,
    tradableUi: tradableUi(supplyUi > 0 ? supplyUi : CHAPTER.totalSupplyUi),
    lpReservedUi: lpBaseReservedUi(supplyUi > 0 ? supplyUi : CHAPTER.totalSupplyUi),
    startPriceUi: chapterStartPriceUi(virtualQuote, virtualBase),
    realQuoteUi,
  };
}

export function customLaunchCurveRaw(draft: CurveDraft): CustomLaunchCurveRaw {
  const preview = customLaunchCurvePreview(draft);
  const decimals = draft.token.decimals;
  const supplyRaw = parseSupply(draft.token.supply) * 10n ** BigInt(decimals);
  const virtualQuoteRaw = uiToRaw(preview.virtualQuoteUi, preview.quoteDecimals);
  const virtualBaseRaw = BigInt(Math.round(preview.virtualBaseUi)) * 10n ** BigInt(decimals);
  const lpReservedRaw = BigInt(Math.round(preview.lpReservedUi)) * 10n ** BigInt(decimals);
  return {
    virtualQuoteRaw,
    virtualBaseRaw,
    realQuoteRaw: 0n,
    realBaseRaw: supplyRaw,
    lpReservedRaw,
    k: virtualQuoteRaw * virtualBaseRaw,
    graduateTargetRaw: uiToRaw(preview.graduateUi, preview.quoteDecimals),
    supplyRaw,
    quoteDecimals: preview.quoteDecimals,
  };
}

export function chapterStateFromRaw(raw: CustomLaunchCurveRaw): ChapterState {
  return {
    virtualQuote: raw.virtualQuoteRaw,
    virtualBase: raw.virtualBaseRaw,
    realQuote: raw.realQuoteRaw,
    realBase: raw.realBaseRaw,
    lpReserved: raw.lpReservedRaw,
    k: raw.k || raw.virtualQuoteRaw * raw.virtualBaseRaw,
    graduateTarget: raw.graduateTargetRaw,
  };
}

export function quoteCustomLaunchBuy(state: ChapterState, quoteIn: bigint, feeBps: number) {
  const bps = Math.min(CUSTOM_LAUNCH_CURVE.maxFeeBps, Math.max(0, feeBps));
  return quoteChapterBuy(state, quoteIn, bps);
}

export function quoteCustomLaunchSell(state: ChapterState, baseIn: bigint, feeBps: number) {
  const bps = Math.min(CUSTOM_LAUNCH_CURVE.maxFeeBps, Math.max(0, feeBps));
  return quoteChapterSell(state, baseIn, bps);
}

export function curveBookLabel(quote: CurveQuote) {
  return quote === "usdc" ? "Custom bonding curve · USDC" : "Custom bonding curve · SOL";
}
