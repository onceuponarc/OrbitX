/**
 * OrbitX revenue fee math. Deliberately free of "server-only" and of any
 * @solana/web3.js import so the exact same arithmetic can run in the API route,
 * in a test, and in the UI — the fee a user is shown and the fee that is
 * collected come from this one implementation.
 *
 * Entirely separate from the creator-fee waterfall (author/vault/protocol
 * amounts in fee_events), which this file does not touch.
 */

/** Trading fee: 0.20% = 20 BPS. */
export const ORBITX_TRADE_FEE_BPS = 20;

/** Launch fee: $0.25 per OrbitX launch. */
export const ORBITX_LAUNCH_FEE_USD = 0.25;

export const ORBITX_REVENUE_WALLET = "2WpoUM5YHKZF6xWM7qDx5f7gFGtNtkAJyQM8dU44CzDs";

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** Assets OrbitX will denominate a revenue fee in. Never an arbitrary launch token. */
const FEE_ASSETS = new Set<string>([WSOL_MINT, USDC_MINT]);

export function isSupportedFeeMint(mint: string) {
  return FEE_ASSETS.has(mint);
}

export type TradeSide = "buy" | "sell";

export type FeeBreakdown = {
  grossRaw: bigint;
  feeRaw: bigint;
  netRaw: bigint;
  feeBps: number;
  /** Mint the fee is collected in — always the quote asset, never the token. */
  feeMint: string;
  side: TradeSide;
};

/**
 * Split a gross amount into fee + net. Floor division, so the collected fee is
 * never larger than the quote displayed. On dust trades the fee floors to 0 and
 * we report 0 rather than displaying a fee we would not collect.
 */
export function splitFee(
  grossRaw: bigint,
  feeMint: string,
  side: TradeSide,
  bps = ORBITX_TRADE_FEE_BPS,
): FeeBreakdown {
  if (grossRaw <= 0n) throw new Error("Enter an amount above zero.");
  if (!isSupportedFeeMint(feeMint)) {
    throw new Error("OrbitX does not collect fees in that asset.");
  }
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error("Invalid fee bps.");
  }
  const feeRaw = (grossRaw * BigInt(bps)) / 10_000n;
  return { grossRaw, feeRaw, netRaw: grossRaw - feeRaw, feeBps: bps, feeMint, side };
}

/**
 * buy  (quote asset -> token): fee comes off the INPUT before the swap, so the
 *   swap only sees the net. Matches "gross input -> fee -> swap input".
 * sell (token -> quote asset): the whole token amount is swapped and the fee is
 *   taken from PROCEEDS. Base is the guaranteed minimum received, not the
 *   optimistic quote — basing it on the optimistic figure would let ordinary
 *   slippage leave the account short and fail the entire transaction. Slippage
 *   upside stays with the user.
 */
export function tradeFee(opts: {
  side: TradeSide;
  quoteMint: string;
  grossInRaw: bigint;
  minOutRaw: bigint;
  bps?: number;
}): FeeBreakdown {
  return opts.side === "buy"
    ? splitFee(opts.grossInRaw, opts.quoteMint, "buy", opts.bps)
    : splitFee(opts.minOutRaw, opts.quoteMint, "sell", opts.bps);
}

/** Raw units -> UI number. Display only; never used for on-chain amounts. */
export function toUi(raw: bigint, decimals: number) {
  return Number(raw) / 10 ** decimals;
}

/** UI number -> raw units. Throws rather than silently truncating a bad input. */
export function toRaw(ui: number, decimals: number): bigint {
  if (!Number.isFinite(ui) || ui <= 0) throw new Error("Enter an amount above zero.");
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error("Bad decimals.");
  return BigInt(Math.round(ui * 10 ** decimals));
}

/**
 * Launch fee in lamports for a $0.25 fee at a given SOL/USD price.
 * Throws on a missing or nonsensical price rather than defaulting to zero — a
 * silent 0 would be an uncollected fee reported as collected.
 */
export function launchFeeLamports(solUsdPrice: number, usd = ORBITX_LAUNCH_FEE_USD): bigint {
  if (!Number.isFinite(solUsdPrice) || solUsdPrice <= 0) {
    throw new Error("No usable SOL price for the launch fee.");
  }
  return BigInt(Math.round((usd / solUsdPrice) * 1_000_000_000));
}
