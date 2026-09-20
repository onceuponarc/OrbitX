/** Add-only CPMM math matching contracts/src/custom-launch/CustomLaunchPool.sol and FeeRouter.sol. */

export const SPLIT_TOTAL_BPS = 10_000;
export const PROTOCOL_SHARE_BPS = 2_500;
export const MAX_TRADE_FEE_BPS = 500;
export const DEST_COUNT = 9;

export const DEST_BY_INDEX = [
  "orbitx",
  "creator",
  "holders",
  "liquidity",
  "buyback",
  "burn",
  "charity",
  "treasury",
  "community",
] as const;

export type DestName = (typeof DEST_BY_INDEX)[number];

export function integerSqrt(y: bigint): bigint {
  if (y > 3n) {
    let z = y;
    let x = y / 2n + 1n;
    while (x < z) {
      z = x;
      x = (y / x + x) / 2n;
    }
    return z;
  }
  return y === 0n ? 0n : 1n;
}

export function swapQuoteOut(opts: {
  quoteIn: boolean;
  amountIn: bigint;
  tradeFeeBps: number;
  reserveToken: bigint;
  reserveQuote: bigint;
}): { amountOut: bigint; fee: bigint } {
  if (opts.amountIn <= 0n) throw new Error("InsufficientBalance");
  if (opts.tradeFeeBps < 0 || opts.tradeFeeBps > MAX_TRADE_FEE_BPS) throw new Error("FeeCap");
  const fee = (opts.amountIn * BigInt(opts.tradeFeeBps)) / BigInt(SPLIT_TOTAL_BPS);
  const effectiveIn = opts.amountIn - fee;
  if (effectiveIn <= 0n) throw new Error("InsufficientBalance");
  const amountOut = opts.quoteIn
    ? (effectiveIn * opts.reserveToken) / (opts.reserveQuote + effectiveIn)
    : (effectiveIn * opts.reserveQuote) / (opts.reserveToken + effectiveIn);
  return { amountOut, fee };
}

/** LP units stay in the pool forever. No remove / withdraw / drain. */
export function addLiquidityUnits(opts: {
  tokenIn: bigint;
  quoteIn: bigint;
  reserveToken: bigint;
  reserveQuote: bigint;
  liquidityUnits: bigint;
}): bigint {
  if (opts.tokenIn <= 0n || opts.quoteIn <= 0n) throw new Error("InsufficientBalance");
  if (opts.liquidityUnits === 0n) return integerSqrt(opts.tokenIn * opts.quoteIn);
  const fromToken = (opts.tokenIn * opts.liquidityUnits) / opts.reserveToken;
  const fromQuote = (opts.quoteIn * opts.liquidityUnits) / opts.reserveQuote;
  return fromToken < fromQuote ? fromToken : fromQuote;
}

export function tokenInForQuote(quoteAmount: bigint, reserveToken: bigint, reserveQuote: bigint): bigint {
  if (quoteAmount <= 0n || reserveToken <= 0n || reserveQuote <= 0n) throw new Error("InsufficientBalance");
  return (quoteAmount * reserveToken) / reserveQuote;
}

export function harvestShares(balance: bigint, splitBps: readonly number[]): { dest: number; name: DestName; share: bigint }[] {
  if (splitBps.length !== DEST_COUNT) throw new Error("SplitInvalid");
  const sum = splitBps.reduce((acc, bps) => acc + bps, 0);
  if (sum !== SPLIT_TOTAL_BPS) throw new Error("SplitInvalid");
  if (splitBps[0] !== PROTOCOL_SHARE_BPS) throw new Error("ProtocolShareLocked");
  if (balance <= 0n) return [];
  const out: { dest: number; name: DestName; share: bigint }[] = [];
  let used = 0n;
  for (let i = 0; i < DEST_COUNT; i++) {
    const share = i === DEST_COUNT - 1 ? balance - used : (balance * BigInt(splitBps[i] ?? 0)) / BigInt(SPLIT_TOTAL_BPS);
    if (share === 0n) continue;
    used += share;
    out.push({ dest: i, name: DEST_BY_INDEX[i]!, share });
  }
  return out;
}

export function parseTokenAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  if (trimmed.startsWith("-")) throw new Error("Amount must be positive.");
  const [wholeRaw, fracRaw = ""] = trimmed.split(".");
  const whole = (wholeRaw ?? "0").replace(/[^\d]/g, "") || "0";
  const frac = fracRaw.replace(/[^\d]/g, "");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}
