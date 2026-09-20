import { readFileSync } from "node:fs";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const types = [
  "../contracts/src/custom-launch/LaunchTypes.sol",
  "../contracts/src/custom-launch/CustomLaunchPool.sol",
  "../contracts/src/custom-launch/CustomLaunchToken.sol",
  "../contracts/src/custom-launch/FeeRouter.sol",
  "../contracts/src/custom-launch/StrategyHub.sol",
  "../contracts/src/custom-launch/CustomLaunchFactory.sol",
  "../contracts/test/CustomLaunch.t.sol",
  "../src/lib/custom-launch/onchain/validate.ts",
  "../src/lib/custom-launch/onchain/evm.ts",
  "../src/lib/custom-launch/onchain/solana.ts",
  "../src/lib/custom-launch/onchain/solana-pool.ts",
  "../src/lib/custom-launch/onchain/solana-pumpswap.ts",
  "../src/lib/custom-launch/onchain/solana-curve.ts",
  "../src/lib/custom-launch/onchain/solana-keys.ts",
  "../src/lib/custom-launch/onchain/evm-uniswap.ts",
  "../src/lib/custom-launch/curve.ts",
  "../src/lib/custom-launch/linked-pools.ts",
  "../src/lib/custom-launch/onchain/pool-math.ts",
  "../src/lib/custom-launch/onchain/actions.ts",
  "../src/lib/custom-launch/execute.ts",
  "../src/lib/custom-launch/deploy.ts",
  "../src/lib/custom-launch/persist.ts",
  "../src/lib/custom-launch/sync.ts",
  "../src/lib/custom-launch/recipients.ts",
  "../src/lib/custom-launch/automation.ts",
  "../src/app/api/custom-launch/deploy/route.ts",
  "../src/app/api/custom-launch/execute/route.ts",
  "../src/app/api/custom-launch/automation/route.ts",
  "../src/app/api/custom-launch/capability/route.ts",
  "../src/app/api/custom-launch/trade/route.ts",
  "../src/app/api/solana/launch/route.ts",
  "../src/app/api/arc/launch/route.ts",
  "../src/app/api/rh/launch/route.ts",
  "../src/components/custom-launch/dev-desk.tsx",
  "../src/components/custom-launch/draft-provider.tsx",
  "../supabase/migrations/0013_custom_launch.sql",
  "../supabase/migrations/0015_custom_launch_curve.sql",
];

for (const file of types) {
  const src = read(file);
  assert(!src.includes("function removeLiquidity"), `${file} must not implement removeLiquidity`);
  assert(!src.includes("withdrawLiquidity"), `${file} must not implement withdrawLiquidity`);
  assert(!src.includes("drain_pool") || file.includes("validate.ts"), `${file} must not add drain_pool`);
}

const auto = read("../src/lib/custom-launch/automation.ts");
assert(!auto.includes('"remove_liquidity"'), "automation catalog dropped remove_liquidity");
assert(auto.includes('"buyback_burn"'), "automation includes buyback & burn");

const pool = read("../contracts/src/custom-launch/CustomLaunchPool.sol");
assert(pool.includes("function addLiquidity"), "pool can add liquidity");
assert(!pool.includes("function remove"), "pool has no remove");
assert(pool.includes("No remove / withdraw / drain"), "pool documents add-only");

const typesSol = read("../contracts/src/custom-launch/LaunchTypes.sol");
assert(typesSol.includes("MAX_TRADE_FEE_BPS = 500"), "on-chain fee cap is 5%");
assert(typesSol.includes("PROTOCOL_SHARE_BPS = 2_500"), "protocol share locked at 25%");
assert(typesSol.includes("NoRemoveLiquidity"), "remove-liquidity is an explicit error");

const factory = read("../contracts/src/custom-launch/CustomLaunchFactory.sol");
assert(factory.includes("_validateSplit"), "factory validates splits");
assert(factory.includes("PROTOCOL_SHARE_BPS"), "factory locks protocol share");
assert(factory.includes("armCurve"), "factory can open a curve without quote LP");
assert(factory.includes("p.quoteLiquidity > 0"), "factory only pulls quote when explicitly seeded after graduation");

const hub = read("../contracts/src/custom-launch/StrategyHub.sol");
assert(hub.includes("onlyCreator"), "hub is creator-gated");
assert(hub.includes("DuplicateExecution"), "hub rejects duplicate exec ids");
assert(hub.includes("recipients[i] == creator"), "holders exclude creator");
assert(hub.includes("dest != LaunchTypes.DEST_CREATOR && to == creator"), "strategy sends cannot hit creator");
assert(hub.includes("function armCurve"), "hub can arm a buyer-funded curve");
assert(hub.includes("function curveFill"), "hub can fill the curve from buyers");
assert(hub.includes("function graduatePool"), "hub can graduate buyer funds into the add-only pool");
assert(!hub.includes("function withdraw"), "hub has no withdraw");

const token = read("../contracts/src/custom-launch/CustomLaunchToken.sol");
assert(token.includes("if (msg.sender != hub)"), "only hub can burn");

const solana = read("../src/lib/custom-launch/onchain/solana.ts");
assert(solana.includes("poolCreate: true"), "Solana adapter exposes the add-only Custom Launch pool");
assert(solana.includes("feeRouter: true"), "Solana adapter exposes fee harvest");
assert(solana.includes("addLiquidity: true"), "Solana adapter can add liquidity");
assert(solana.includes("protocol.publicKey"), "Solana mint/withdraw authority is protocol");
assert(solana.includes("customLaunchVaultKeypair"), "Solana vaults are protocol-derived");
assert(solana.includes("customLaunchCurveKeypair"), "Solana curve vault is protocol-derived");
assert(solana.includes("TOKEN_PROGRAM_ID"), "Solana Custom Launch supports SPL");
assert(solana.includes("TOKEN_2022_PROGRAM_ID"), "Solana Custom Launch supports Token-2022");
assert(!solana.includes("exportDeskSecret"), "strategy vaults must not use exportable desk secrets");
assert(solana.includes("Remove liquidity is not a Custom Launch action"), "Solana adapter blocks remove-liquidity");
assert(!solana.includes("seedSolanaPumpSwapPool"), "Solana deploy does not seed PumpSwap from OrbitX");
assert(!solana.includes("preflightOrbitxPumpSwap"), "Solana deploy does not preflight protocol quote LP");
assert(!solana.includes("preflightSolanaPoolSeed"), "Solana deploy does not bill the desk for quote liquidity");
assert(!solana.includes("seedSolanaCustomLaunchPool"), "Solana deploy does not seed the homemade CPMM as the public book");
assert(solana.includes("Neither OrbitX nor the creator deposits quote LP"), "Solana note forbids protocol/creator LP");

const pumpswap = read("../src/lib/custom-launch/onchain/solana-pumpswap.ts");
assert(pumpswap.includes("createPoolInstructions"), "PumpSwap create is available at graduation");
assert(pumpswap.includes("graduateSolanaPumpSwapFromVault"), "PumpSwap opens from the buyer-funded vault");
assert(pumpswap.includes("OrbitX and the creator do not seed LP"), "PumpSwap graduation refuses protocol/creator quote");
assert(!pumpswap.includes('from("stories")'), "Custom Launch PumpSwap does not write stories");
assert(!pumpswap.includes("withdrawInstructions"), "Custom Launch PumpSwap never withdraws LP");
assert(!pumpswap.includes("pumpswap-pool"), "Custom Launch PumpSwap is isolated from Normal Launch graduation");

const solanaPool = read("../src/lib/custom-launch/onchain/solana-pool.ts");
assert(solanaPool.includes("addLiquidityUnits"), "Solana pool uses add-only CPMM units");
assert(!solanaPool.includes("function removeLiquidity"), "Solana pool must not implement removeLiquidity");
assert(!solanaPool.includes("withdrawLiquidity"), "Solana pool must not withdraw liquidity");
assert(solanaPool.includes("No harvestable Custom Launch fees"), "empty harvest is not a fake success");
assert(solanaPool.includes("createSyncNativeInstruction"), "SOL quote wraps to WSOL");

const poolMath = read("../src/lib/custom-launch/onchain/pool-math.ts");
assert(poolMath.includes("No remove / withdraw / drain"), "pool math documents add-only");
assert(poolMath.includes("PROTOCOL_SHARE_BPS = 2_500"), "pool math locks protocol share");
assert(poolMath.includes("MAX_TRADE_FEE_BPS = 500"), "pool math caps the trade fee");

const evm = read("../src/lib/custom-launch/onchain/evm.ts");
assert(evm.includes("waitForTransactionReceipt"), "EVM waits for confirmation");
assert(evm.includes("receipt.status !== \"success\""), "EVM rejects reverted receipts");
assert(evm.includes("harvestAll"), "EVM can harvest the fee router");
assert(evm.includes("quoteLiquidity: 0n"), "EVM createLaunch does not seed quote LP");
assert(evm.includes("Neither OrbitX nor the creator deposits quote LP"), "EVM adapter forbids protocol/creator LP");
assert(!evm.includes("OrbitX seeds Custom Launch liquidity"), "EVM adapter no longer requires a seeder quote");

const evmUni = read("../src/lib/custom-launch/onchain/evm-uniswap.ts");
assert(evmUni.includes("addLiquidity"), "Uniswap helper can add liquidity");
assert(!evmUni.includes("removeLiquidity"), "Uniswap helper has no remove");
assert(!evmUni.includes("function remove"), "Uniswap helper has no remove function");

const validate = read("../src/lib/custom-launch/onchain/validate.ts");
assert(validate.includes("ORBITX_PROTOCOL"), "protocol dest is centralized");
assert(validate.includes("4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu") === false, "validate must not hardcode the dest string");

const protocol = read("../src/lib/custom-launch/protocol.ts");
assert(protocol.includes("4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu"), "protocol.ts owns the Solana dest");

const persist = read("../src/lib/custom-launch/persist.ts");
assert(persist.includes("Cannot mark a Custom Launch live without a confirmed transaction"), "live requires tx");
assert(persist.includes("Completed executions require a confirmed transaction hash"), "completed requires hash");
assert(persist.includes("custom_launches"), "uses custom_launches not stories");
assert(persist.includes('role: "secondary"'), "secondary markets are persisted");
assert(persist.includes("insertDistributions"), "holder distributions are written");
assert(persist.includes("linkedCanonicalPools"), "canonical funded DEX books are linked");
assert(persist.includes('kind: "canonical"'), "linked books are marked canonical");
assert(persist.includes("curve_status"), "curve state is persisted on custom_launches");
assert(!persist.includes('from("stories")'), "Custom Launch persist does not write stories");

const sync = read("../src/lib/custom-launch/sync.ts");
assert(sync.includes("readHubBalance") || sync.includes("getTokenAccountBalance"), "vault sync reads chain balances");
assert(sync.includes("volume: 0"), "volume is not faked");

const autoRoute = read("../src/app/api/custom-launch/automation/route.ts");
assert(autoRoute.includes("liveReadingsForLaunch"), "automation uses chain readings");
assert(autoRoute.includes("holderLines"), "automation can pass holder recipients");

const normalSolana = read("../src/app/api/solana/launch/route.ts");
const normalArc = read("../src/app/api/arc/launch/route.ts");
const normalRh = read("../src/app/api/rh/launch/route.ts");
assert(normalSolana.includes("deskSolanaKey"), "Normal Solana launch still uses the desk");
assert(normalArc.includes("launchWithArgus"), "Normal Arc launch still uses Argus");
assert(normalRh.includes("export") || normalRh.includes("POST"), "Normal RH launch route remains");
assert(!normalSolana.includes("custom_launches"), "Normal Solana launch does not write custom_launches");
assert(!normalArc.includes("custom_launches"), "Normal Arc launch does not write custom_launches");

const sql = read("../supabase/migrations/0013_custom_launch.sql");
assert(sql.includes("trade_fee_bps <= 500"), "DB fee cap is 5%");
assert(sql.includes("custom_launch_rules_no_remove_liq"), "rules reject remove_liquidity");
assert(sql.includes("custom_launch_executions_no_remove_liq"), "executions reject remove_liquidity");
assert(sql.includes("status=completed only after a confirmed chain transaction"), "SQL comment forbids intent-as-success");

const sql15 = read("../supabase/migrations/0015_custom_launch_curve.sql");
assert(sql15.includes("real_quote_raw"), "curve real quote is persisted");
assert(sql15.includes("Never seeded by OrbitX or the creator"), "migration documents buyer-funded quote");
assert(sql15.includes("kind in ('curve', 'canonical', 'graduated', 'recorded')"), "markets store curve and canonical books");
assert(!sql15.includes("insert into public.stories"), "curve migration does not write stories");

const desk = read("../src/components/custom-launch/dev-desk.tsx");
assert(desk.includes("Claim creator fees"), "desk has creator claim");
assert(desk.includes("/api/custom-launch/execute"), "desk hits execute API");
assert(!desk.includes("Remove liquidity"), "desk has no remove liquidity");
assert(desk.includes("Buyback & burn"), "desk can show buyback & burn");
assert(desk.includes("Holder recipients"), "desk captures holder recipients");
assert(desk.includes("Live readings") || desk.includes("Automation inputs"), "desk exposes live readings");
assert(desk.includes("parseHolderLines"), "desk parses holder lines");

const provider = read("../src/components/custom-launch/draft-provider.tsx");
assert(provider.includes("/api/custom-launch/deploy"), "wizard deploys through Custom Launch API");
assert(provider.includes("/api/custom-launch/capability"), "wizard checks chain capability and session");
assert(!provider.includes("/api/solana/launch"), "wizard does not call Normal Solana launch");
assert(!provider.includes("/api/arc/launch"), "wizard does not call Normal Arc launch");
assert(provider.includes("Deployment did not confirm on-chain"), "wizard requires a confirmed hash");

const {
  assertTradingFeeBps,
  assertFeeSplits,
  assertAllowedAction,
} = await import("../src/lib/custom-launch/onchain/validate.ts");
const { enabledExecuteActions, mapRuleAction } = await import("../src/lib/custom-launch/onchain/actions.ts");
const { ruleConditionsMet, cooldownOpen } = await import("../src/lib/custom-launch/engine.ts");
const { createLaunchModeState, setPrimaryStrategy, toggleStrategyModule } = await import("../src/lib/custom-launch/modes.ts");
const { createFeeConfig } = await import("../src/lib/custom-launch/fees.ts");
const { createTokenConfig } = await import("../src/lib/custom-launch/token.ts");
const { createSupplyPlan } = await import("../src/lib/custom-launch/supply.ts");
const { createMarketsConfig } = await import("../src/lib/custom-launch/markets.ts");
const { createAutomationConfig } = await import("../src/lib/custom-launch/automation.ts");
const { ORBITX_PROTOCOL } = await import("../src/lib/custom-launch/protocol.ts");

let threw = false;
try {
  assertTradingFeeBps(501);
} catch {
  threw = true;
}
assert(threw, "fee >5% is rejected");
assertTradingFeeBps(500);
assertTradingFeeBps(0);

threw = false;
try {
  assertFeeSplits([
    { dest: "orbitx", bps: 2400 },
    { dest: "creator", bps: 7600 },
  ]);
} catch {
  threw = true;
}
assert(threw, "protocol share cannot be rewritten");
assertFeeSplits([
  { dest: "orbitx", bps: ORBITX_PROTOCOL.allocationBps },
  { dest: "creator", bps: 7500 },
]);

threw = false;
try {
  assertAllowedAction("remove_liquidity");
} catch {
  threw = true;
}
assert(threw, "remove_liquidity is blocked");
threw = false;
try {
  mapRuleAction("remove_liquidity");
} catch {
  threw = true;
}
assert(threw, "rule mapper rejects remove_liquidity");
assert(mapRuleAction("buyback") === "buyback", "buyback maps");
assert(mapRuleAction("send_creator") === "creator_claim", "creator claim is distinct");
assert(mapRuleAction("reward_holders") === "holders", "holders map");

function draftFor(chain: "arc" | "solana" | "robinhood") {
  const mode = createLaunchModeState();
  return {
    version: 4 as const,
    chain,
    mode,
    token: createTokenConfig(18),
    supply: createSupplyPlan(),
    fees: createFeeConfig(mode),
    economics: { quote: "usdc" as const, maxWalletBps: 200, maxTxBps: 100, transferRestricted: false },
    markets: createMarketsConfig(),
    automation: createAutomationConfig(),
    reviewedAt: null,
  };
}

const draft = draftFor("arc");
draft.mode = setPrimaryStrategy(createLaunchModeState(), "buyback");
draft.mode = toggleStrategyModule(draft.mode, "burn");
draft.fees = createFeeConfig(draft.mode);
const enabled = enabledExecuteActions(draft.mode, draft);
assert(enabled.includes("buyback"), "buyback button is enabled when configured");
assert(enabled.includes("burn"), "burn button is enabled when configured");
assert(enabled.includes("buyback_burn"), "combined action appears when both are on");
assert(enabled.includes("creator_claim"), "creator claim stays separate");

const burnOnly = draftFor("arc");
burnOnly.mode = setPrimaryStrategy(createLaunchModeState(), "burn");
burnOnly.fees = createFeeConfig(burnOnly.mode);
const burnActions = enabledExecuteActions(burnOnly.mode, burnOnly);
assert(burnActions.includes("burn"), "burn-only shows burn");
assert(!burnActions.includes("buyback"), "burn-only hides buyback");
assert(!burnActions.includes("buyback_burn"), "burn-only hides combined");

assert(
  ruleConditionsMet(
    {
      id: "r1",
      name: "fees",
      status: "active",
      trigger: "fee_balance",
      join: "and",
      conditions: [{ id: "c1", metric: "fee_balance", op: "gte", value: "100" }],
      actions: [],
      routes: [],
      cooldown: "1h",
      maxExecution: "1000",
      lastExecution: null,
      nextExecution: null,
    },
    { feeBalance: 100, marketCap: 0, volume: 0, holders: 0, liquidity: 0, now: Date.now() },
  ),
  "configurable $100 threshold trips",
);
assert(
  !ruleConditionsMet(
    {
      id: "r2",
      name: "fees",
      status: "active",
      trigger: "fee_balance",
      join: "and",
      conditions: [{ id: "c1", metric: "fee_balance", op: "gte", value: "250" }],
      actions: [],
      routes: [],
      cooldown: "1h",
      maxExecution: "1000",
      lastExecution: null,
      nextExecution: null,
    },
    { feeBalance: 100, marketCap: 0, volume: 0, holders: 0, liquidity: 0, now: Date.now() },
  ),
  "non-100 threshold is respected",
);
assert(cooldownOpen(null, 60), "no last run means cooldown is open");
assert(!cooldownOpen(new Date().toISOString(), 3600), "fresh execution is cooling down");

const { parseHolderLines } = await import("../src/lib/custom-launch/recipients.ts");
const parsed = parseHolderLines("WalletOne 1000\nWalletTwo,2000\n");
assert(parsed.length === 2 && parsed[1].amount === "2000", "holder lines parse address and amount");
let holderThrew = false;
try {
  parseHolderLines("incomplete-line");
} catch {
  holderThrew = true;
}
assert(holderThrew, "malformed holder lines are rejected");

const {
  integerSqrt,
  swapQuoteOut,
  addLiquidityUnits,
  harvestShares,
  parseTokenAmount,
  tokenInForQuote,
  PROTOCOL_SHARE_BPS,
} = await import("../src/lib/custom-launch/onchain/pool-math.ts");

const tokenSeed = 200_000_000n * 10n ** 18n;
const quoteSeed = 10_000n * 10n ** 6n;
const seedUnits = addLiquidityUnits({
  tokenIn: tokenSeed,
  quoteIn: quoteSeed,
  reserveToken: 0n,
  reserveQuote: 0n,
  liquidityUnits: 0n,
});
assert(seedUnits === integerSqrt(tokenSeed * quoteSeed), "first seed units are sqrt(token*quote)");
assert(seedUnits > 0n, "seed units are positive");

const swap = swapQuoteOut({
  quoteIn: true,
  amountIn: 1_000n * 10n ** 6n,
  tradeFeeBps: 300,
  reserveToken: tokenSeed,
  reserveQuote: quoteSeed,
});
const expectedFee = (1_000n * 10n ** 6n * 300n) / 10_000n;
assert(swap.fee === expectedFee, "swap fee matches EVM amountIn * bps / 10000");
assert(swap.amountOut === ( (1_000n * 10n ** 6n - expectedFee) * tokenSeed) / (quoteSeed + (1_000n * 10n ** 6n - expectedFee)), "x*y=k quote-in matches EVM");

const split = [2500, 2500, 1500, 1500, 1000, 500, 200, 200, 100];
const shares = harvestShares(expectedFee, split);
assert(shares.reduce((sum, row) => sum + row.share, 0n) === expectedFee, "harvest splits 100% of fees");
assert(shares.find((row) => row.name === "orbitx")?.share === (expectedFee * BigInt(PROTOCOL_SHARE_BPS)) / 10_000n, "protocol harvest share is 25%");
assert(shares.find((row) => row.name === "buyback")?.share === (expectedFee * 1000n) / 10_000n, "buyback harvest share matches EVM test");

const dust = harvestShares(1n, split);
assert(dust.reduce((sum, row) => sum + row.share, 0n) === 1n, "dust harvest still sums to 100%");
assert(dust.at(-1)?.share === 1n, "rounding remainder goes to the last destination");

threw = false;
try {
  harvestShares(100n, [2400, 2600, 1500, 1500, 1000, 500, 200, 200, 100]);
} catch {
  threw = true;
}
assert(threw, "harvest rejects a rewritten protocol share");

threw = false;
try {
  addLiquidityUnits({ tokenIn: 0n, quoteIn: 1n, reserveToken: 1n, reserveQuote: 1n, liquidityUnits: 1n });
} catch {
  threw = true;
}
assert(threw, "add-liquidity rejects a zero side");

assert(parseTokenAmount("50", 9) === 50n * 10n ** 9n, "SOL seed amount is 9 decimals");
assert(parseTokenAmount("5000", 6) === 5000n * 10n ** 6n, "USDC seed amount is 6 decimals");
assert(tokenInForQuote(1_000n * 10n ** 6n, tokenSeed, quoteSeed) === (1_000n * 10n ** 6n * tokenSeed) / quoteSeed, "add-liquidity token side matches StrategyHub");

threw = false;
try {
  swapQuoteOut({ quoteIn: true, amountIn: 1n, tradeFeeBps: 501, reserveToken: 1n, reserveQuote: 1n });
} catch {
  threw = true;
}
assert(threw, "pool math rejects fees above 5%");

const { customLaunchPoolKeypair, customLaunchFeeRouterKeypair, customLaunchVaultKeypair } = await import(
  "../src/lib/custom-launch/onchain/solana-keys.ts"
);
const poolA = customLaunchPoolKeypair("launch-1");
const poolB = customLaunchPoolKeypair("launch-1");
assert(poolA.publicKey.equals(poolB.publicKey), "pool authority is deterministic per launch");
assert(!poolA.publicKey.equals(customLaunchPoolKeypair("launch-2").publicKey), "pool authority is unique per launch");
assert(
  !poolA.publicKey.equals(customLaunchFeeRouterKeypair("launch-1").publicKey),
  "fee router is a distinct protocol-derived key",
);
assert(
  !poolA.publicKey.equals(customLaunchVaultKeypair("launch-1", "buyback").publicKey),
  "pool authority is not a strategy vault",
);

const curveSrc = read("../src/lib/custom-launch/curve.ts");
assert(curveSrc.includes("realQuoteRaw: 0n"), "curve real quote starts at zero");
assert(curveSrc.includes("quoteChapterBuy"), "Custom Launch curve reuses Chapter buy math");
assert(curveSrc.includes("graduateTargetRaw"), "curve has a graduation target");

const { quoteChapterBuy } = await import("../src/lib/solana/curve.ts");
const virtualQuote = 30_000_000_000n;
const virtualBase = 1_073_000_000n * 10n ** 9n;
const supply = 1_000_000_000n * 10n ** 9n;
const buy = quoteChapterBuy(
  {
    virtualQuote,
    virtualBase,
    realQuote: 0n,
    realBase: supply,
    lpReserved: 200_000_000n * 10n ** 9n,
    k: virtualQuote * virtualBase,
    graduateTarget: 2_000_000_000n,
  },
  1_000_000_000n,
  300,
);
assert(buy.baseOut > 0n, "a buy against virtual reserves returns tokens");
assert(buy.nextRealQuote > 0n, "buyer quote is credited to the curve");
assert(!buy.wouldEatLp, "first small buy does not consume reserved LP");

console.log(JSON.stringify({ ok: true, customLaunch: "bonding-curve" }));
