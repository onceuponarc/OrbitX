import {
  aggregateDexPairs,
  floorWindows,
  mergeOhlcv,
  overlayLaunchVolume,
  sumPadVolume,
  volumeKey,
  type DexPairVolume,
} from "../src/lib/token-volume.ts";
import { OFFICIAL_TOKEN } from "../src/lib/official-token.ts";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const ORBITX = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const POOL = "7cLiruk2Fpravgf57NQeZBMaMxzehMa74LkESh9qEhGD";

const fixturePair: DexPairVolume = {
  chainId: "solana",
  pairAddress: POOL,
  dexId: "pumpswap",
  priceUsd: "0.00003538",
  priceChange: { h24: 8.18 },
  marketCap: 34103,
  liquidity: { usd: 15397.28 },
  volume: { h24: 4953.03, h6: 2545.11, h1: 99.07 },
  baseToken: { address: ORBITX },
  quoteToken: { address: "So11111111111111111111111111111111111111112" },
};

const dex = aggregateDexPairs(ORBITX, "solana", [fixturePair, { ...fixturePair, volume: { h24: 40 } }]);
assert(volumeKey("solana", ORBITX) === `solana:${ORBITX}`, "solana mint key keeps base58 case");
assert(volumeKey("arc", "0xABC") === "arc:0xabc", "evm mint key is lowercased");
assert(Math.abs(dex.dayUsd - 4993.03) < 0.001, `24h sums every pair, got ${dex.dayUsd}`);
assert(dex.weekUsd >= dex.dayUsd, "week floors at 24h before candles");
assert(dex.totalUsd >= dex.weekUsd, "total floors at week before candles");
assert(dex.pairAddress === POOL, "keeps the deepest pair");
assert(dex.priceUsd === 0.00003538, "reads DexScreener price");
assert(dex.changePct === 8.18, "reads 24h change");

const now = 1_789_836_000;
const candles = [
  [now, 0, 0, 0, 0, 100],
  [now - 2 * 86400, 0, 0, 0, 0, 200],
  [now - 8 * 86400, 0, 0, 0, 0, 9_000],
];
const merged = mergeOhlcv(dex, candles, now);
assert(merged.dayUsd === dex.dayUsd, "candles do not replace rolling 24h");
assert(merged.weekUsd === Math.max(dex.dayUsd, 300), `7d is last 7 calendar days, got ${merged.weekUsd}`);
assert(merged.totalUsd === Math.max(merged.weekUsd, 9_300), `lifetime sums every candle, got ${merged.totalUsd}`);

const empty = aggregateDexPairs(ORBITX, "solana", []);
assert(empty.dayUsd === 0 && empty.pairAddress === null, "missing pairs stay zero");

const floored = floorWindows({ dayUsd: 50, weekUsd: 10, totalUsd: 5 });
assert(floored.weekUsd === 50 && floored.totalUsd === 50, "windows never go backwards");

const overlaid = overlayLaunchVolume(
  {
    volumeUi: 1,
    volumeDayUsd: 1,
    volumeWeekUsd: 1,
    volumeTotalUsd: 1,
    priceUi: 0.01,
    changePct: 0,
    mcapUi: 0,
  },
  merged,
);
assert(overlaid.volumeDayUsd === merged.dayUsd, "overlay prefers live 24h");
assert(overlaid.volumeUi === merged.dayUsd, "cards use 24h as the headline volume");
assert(overlaid.priceUi === merged.priceUsd, "overlay writes mark price");

const pad = sumPadVolume(
  [{ volumeDayUsd: 10, volumeWeekUsd: 20, volumeTotalUsd: 30 }],
  { dayUsd: 5, weekUsd: 15, totalUsd: 100 },
);
assert(pad.dayUsd === 15, "pad 24h includes official mint extra");
assert(pad.weekUsd === 35, "pad 7d includes official mint extra");
assert(pad.totalUsd === 130, "pad total includes official mint extra");

assert(OFFICIAL_TOKEN.mint === ORBITX, "fixture mint is the live $ORBITX CA");

const live = await loadLiveOrbitx();
if (live) {
  assert(live.dayUsd > 0, `live $ORBITX 24h must not be $0, got ${live.dayUsd}`);
  assert(live.weekUsd >= live.dayUsd, `live 7d ${live.weekUsd} should cover 24h ${live.dayUsd}`);
  assert(live.totalUsd >= live.weekUsd, `live total ${live.totalUsd} should cover 7d ${live.weekUsd}`);
  console.log(
    JSON.stringify({
      ok: true,
      live: { dayUsd: live.dayUsd, weekUsd: live.weekUsd, totalUsd: live.totalUsd, pair: live.pairAddress },
    }),
  );
} else {
  console.log(JSON.stringify({ ok: true, live: null, note: "offline parsers passed" }));
}

async function loadLiveOrbitx() {
  try {
    const { loadTokenVolumes, volumeKey: key } = await import("../src/lib/token-volume.ts");
    const map = await loadTokenVolumes([{ chain: "solana", mint: ORBITX }]);
    return map.get(key("solana", ORBITX)) ?? null;
  } catch {
    return null;
  }
}
