import { readFileSync } from "node:fs";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const argus = readFileSync(new URL("../src/lib/arc/argus.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/arc/launch/route.ts", import.meta.url), "utf8");
const studio = readFileSync(new URL("../src/components/launch/arc-launch-studio.tsx", import.meta.url), "utf8");
const story = readFileSync(new URL("../src/app/story/[slug]/page.tsx", import.meta.url), "utf8");

assert(argus.includes("devBuyQuote: seed.usdc6"), "Argus launch must pass a USDC seed as devBuyQuote");
assert(!argus.includes("devBuyQuote: 0n"), "Argus launch must not open with a 0 USDC buy");
assert(argus.includes("ARGUS_DEFAULT_SEED_USDC = 10"), "default seed must stay a real USDC amount");
assert(argus.includes("ARGUS_START_FDV_USDC6 = 2_500n"), "start FDV should match live Argus Portal #7 defaults");
assert(argus.includes("ARGUS_BOND_FDV_USDC6 = 45_000n"), "bond FDV should match live Argus Portal #7 defaults");
assert(route.includes("seedUsdc: body.seedUsdc"), "launch API must accept a seed");
assert(route.includes("curve_quote_lamports: result.seedUsdc6"), "stories row must persist the seed as pool depth");
assert(route.includes("quote_decimals: 6"), "Arc quote decimals must be USDC 6, not Solana 9");
assert(route.includes('mechanism: "uniswap_v4"'), "Argus launches must bind the v4 pool");
assert(studio.includes("Seed liquidity (USDC)"), "studio must collect the USDC seed");
assert(studio.includes("DevFundBanner"), "studio must show the in-app Arc wallet to fund");
assert(story.includes("isArgus"), "story page must treat Argus as a seeded pool, not a 0 curve");
assert(story.includes("seed / bond FDV") || story.includes("Pool"), "story page must show pool depth, not Curve 0");

console.log(JSON.stringify({
  ok: true,
  seedDefault: 10,
  startFdv: 2500,
  bondFdv: 45000,
}));
