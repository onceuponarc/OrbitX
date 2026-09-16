/**
 * Fee-math and vanity-matching checks. Run with:  bun scripts/check-orbitx-fees.ts
 *
 * Imports the real modules by relative path (not the @/ alias) so this runs
 * without Next.js, and covers the arithmetic that decides both what the UI shows
 * and what is actually collected — they come from the same functions.
 */
import {
  ORBITX_TRADE_FEE_BPS,
  USDC_MINT,
  WSOL_MINT,
  launchFeeLamports,
  splitFee,
  toRaw,
  toUi,
  tradeFee,
} from "../src/lib/solana/orbitx-fee-math";
import {
  isMintableSuffix,
  mintEndsWith,
  expectedAttempts,
} from "../src/lib/solana/vanity-match";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function throws(name: string, fn: () => unknown) {
  try {
    fn();
    check(name, false, "expected a throw");
  } catch {
    check(name, true);
  }
}

console.log("fee rate");
check("trading fee is 20 bps", ORBITX_TRADE_FEE_BPS === 20);

console.log("buy: gross -> fee -> net");
{
  const gross = toRaw(1, 9); // 1 SOL
  const fee = splitFee(gross, WSOL_MINT, "buy");
  check("fee on 1 SOL is 0.002 SOL", fee.feeRaw === 2_000_000n, String(fee.feeRaw));
  check("net swapped is 0.998 SOL", fee.netRaw === 998_000_000n, String(fee.netRaw));
  check("fee + net === gross exactly", fee.feeRaw + fee.netRaw === fee.grossRaw);
  check("fee is never applied twice", splitFee(fee.grossRaw, WSOL_MINT, "buy").feeRaw === fee.feeRaw);
}

console.log("usdc buy");
{
  const gross = toRaw(100, 6); // 100 USDC
  const fee = splitFee(gross, USDC_MINT, "buy");
  check("fee on 100 USDC is 0.2 USDC", fee.feeRaw === 200_000n, String(fee.feeRaw));
  check("net is 99.8 USDC", toUi(fee.netRaw, 6) === 99.8);
}

console.log("sell: fee comes off proceeds, based on guaranteed minimum");
{
  const fee = tradeFee({
    side: "sell",
    quoteMint: WSOL_MINT,
    grossInRaw: toRaw(1_000_000, 6), // token amount, irrelevant to the fee
    minOutRaw: toRaw(2, 9), // 2 SOL guaranteed
  });
  check("fee is 20 bps of min received", fee.feeRaw === 4_000_000n, String(fee.feeRaw));
  check("fee mint is the quote asset, not the token", fee.feeMint === WSOL_MINT);
  check("user keeps the rest", fee.netRaw === 1_996_000_000n);
}

console.log("rounding never overcharges");
{
  // 4999 raw * 20 / 10000 = 9.998 -> floors to 9, never 10.
  const fee = splitFee(4999n, USDC_MINT, "buy");
  check("floors rather than rounds up", fee.feeRaw === 9n, String(fee.feeRaw));
  check("net absorbs the remainder", fee.netRaw === 4990n);
}

console.log("dust");
{
  const fee = splitFee(10n, USDC_MINT, "buy");
  check("fee floors to 0 and is reported as 0", fee.feeRaw === 0n);
  check("nothing is silently taken", fee.netRaw === 10n);
}

console.log("rejections");
throws("zero amount throws", () => splitFee(0n, WSOL_MINT, "buy"));
throws("negative amount throws", () => splitFee(-1n, WSOL_MINT, "buy"));
throws("fee in an arbitrary token is refused", () =>
  splitFee(1000n, "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", "buy"),
);
throws("toRaw rejects zero", () => toRaw(0, 9));
throws("toRaw rejects NaN", () => toRaw(Number.NaN, 9));

console.log("launch fee");
{
  check("$0.25 at $250/SOL is 0.001 SOL", launchFeeLamports(250) === 1_000_000n);
  check("$0.25 at $100/SOL is 0.0025 SOL", launchFeeLamports(100) === 2_500_000n);
}
throws("no price means no silent zero fee", () => launchFeeLamports(0));
throws("negative price throws", () => launchFeeLamports(-5));

console.log("vanity suffix matching");
check("exact lowercase obx matches", mintEndsWith("SoMeMintThatEndsInobx", "obx"));
check("uppercase variant is REJECTED", !mintEndsWith("SoMeMintThatEndsInoBX", "obx"));
check("mixed case is REJECTED", !mintEndsWith("SoMeMintThatEndsInoBx", "obx"));
check("non-match is rejected", !mintEndsWith("SoMeMintThatEndsInabc", "obx"));
check("obx is a valid base58 suffix", isMintableSuffix("obx"));
check("uppercase O is not base58", !isMintableSuffix("Obx"));
check("0 is not base58", !isMintableSuffix("0bx"));
check("l is not base58", !isMintableSuffix("lbx"));
check("expected work for obx is 58^3", expectedAttempts(3) === 195_112);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
