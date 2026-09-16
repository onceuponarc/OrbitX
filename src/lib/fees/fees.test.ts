import { describe, expect, test } from "bun:test";

import { applyBps, splitByBps } from "./bps";
import {
  assertUsableRevenueWallet,
  chainFeeConfig,
  feeRateLabel,
  launchFeesEnabled,
  tradeFeesEnabled,
} from "./chains";

const ARC_WALLET = "0xC1149913d96546c86956f042e4Ac9e9ad192f55F";
const SOLANA_WALLET = "2WpoUM5YHKZF6xWM7qDx5f7gFGtNtkAJyQM8dU44CzDs";

describe("bps arithmetic", () => {
  test("0.20% of 1000 USDC (6dp) is 2 USDC", () => {
    expect(applyBps(1_000_000_000n, 20)).toBe(2_000_000n);
  });

  test("floors rather than rounding up, so we never overcharge", () => {
    // 1.999 USDC * 20bps = 3999.8 raw -> 3999
    expect(applyBps(1_999_900n, 20)).toBe(3_999n);
  });

  test("dust floors to zero instead of a fee we would not collect", () => {
    expect(applyBps(499n, 20)).toBe(0n);
  });

  test("fee plus net always reconstructs gross exactly", () => {
    for (const gross of [1n, 999n, 1_000_000n, 123_456_789n, 10n ** 18n]) {
      const s = splitByBps(gross, 20);
      expect(s.feeRaw + s.netRaw).toBe(gross);
      expect(s.feeRaw).toBeLessThanOrEqual(gross);
    }
  });

  test("rejects nonsense rates instead of silently coercing", () => {
    expect(() => applyBps(1_000n, -1)).toThrow();
    expect(() => applyBps(1_000n, 10_001)).toThrow();
    expect(() => applyBps(1_000n, 1.5)).toThrow();
  });

  test("rejects a non-positive amount", () => {
    expect(() => splitByBps(0n, 20)).toThrow();
    expect(() => splitByBps(-5n, 20)).toThrow();
  });
});

describe("arc fee configuration", () => {
  test("arc collects 0.20% into the owner-supplied Arc wallet", () => {
    const cfg = chainFeeConfig("arc");
    expect(cfg.tradeFeeBps).toBe(20);
    expect(cfg.launchFeeUsd).toBe(0.25);
    expect(cfg.revenueWallet).toBe(ARC_WALLET);
    expect(feeRateLabel("arc")).toBe("0.20%");
  });

  test("arc fees are denominated in USDC ERC-20 at 6dp, not 18dp native gas", () => {
    expect(chainFeeConfig("arc").feeAssetDecimals).toBe(6);
  });

  test("arc trade and launch fees are live", () => {
    expect(tradeFeesEnabled("arc")).toBe(true);
    expect(launchFeesEnabled("arc")).toBe(true);
  });

  test("rh stays unmonetized while it has no revenue wallet of its own", () => {
    expect(chainFeeConfig("rh").revenueWallet).toBeNull();
    expect(tradeFeesEnabled("rh")).toBe(false);
    expect(launchFeesEnabled("rh")).toBe(false);
  });
});

describe("revenue wallet prohibitions", () => {
  test("accepts the checksummed Arc wallet", () => {
    expect(assertUsableRevenueWallet("arc", ARC_WALLET)).toBe(ARC_WALLET);
  });

  test("refuses a missing wallet rather than collecting into nowhere", () => {
    expect(() => assertUsableRevenueWallet("rh", null)).toThrow(/No OrbitX revenue wallet/);
  });

  test("refuses the zero and burn addresses", () => {
    expect(() =>
      assertUsableRevenueWallet("arc", "0x0000000000000000000000000000000000000000"),
    ).toThrow();
    expect(() =>
      assertUsableRevenueWallet("arc", "0x000000000000000000000000000000000000dEaD"),
    ).toThrow();
  });

  test("refuses obvious placeholders", () => {
    expect(() =>
      assertUsableRevenueWallet("arc", "0x1234567890123456789012345678901234567890"),
    ).toThrow(/placeholder/);
  });

  test("refuses a malformed EVM address", () => {
    expect(() => assertUsableRevenueWallet("arc", "0xC114")).toThrow(/not a valid address/);
  });

  test("refuses the Solana revenue wallet on Arc, and the Arc wallet on Solana", () => {
    expect(() => assertUsableRevenueWallet("arc", SOLANA_WALLET)).toThrow();
    expect(() => assertUsableRevenueWallet("solana", ARC_WALLET)).toThrow();
  });

  test("refuses a base58 wallet that is not valid base58", () => {
    expect(() => assertUsableRevenueWallet("solana", "0OIl-not-base58")).toThrow();
  });
});
