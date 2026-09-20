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
  "../src/app/api/solana/launch/route.ts",
  "../src/app/api/arc/launch/route.ts",
  "../src/app/api/rh/launch/route.ts",
  "../src/components/custom-launch/dev-desk.tsx",
  "../src/components/custom-launch/draft-provider.tsx",
  "../supabase/migrations/0013_custom_launch.sql",
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

const hub = read("../contracts/src/custom-launch/StrategyHub.sol");
assert(hub.includes("onlyCreator"), "hub is creator-gated");
assert(hub.includes("DuplicateExecution"), "hub rejects duplicate exec ids");
assert(hub.includes("recipients[i] == creator"), "holders exclude creator");
assert(hub.includes("dest != LaunchTypes.DEST_CREATOR && to == creator"), "strategy sends cannot hit creator");
assert(!hub.includes("function withdraw"), "hub has no withdraw");

const token = read("../contracts/src/custom-launch/CustomLaunchToken.sol");
assert(token.includes("if (msg.sender != hub)"), "only hub can burn");

const solana = read("../src/lib/custom-launch/onchain/solana.ts");
assert(solana.includes("poolCreate: false"), "Solana adapter does not fake a pool");
assert(solana.includes("protocol.publicKey"), "Solana mint/withdraw authority is protocol");
assert(solana.includes("customLaunchVaultKeypair"), "Solana vaults are protocol-derived");
assert(!solana.includes("exportDeskSecret"), "strategy vaults must not use exportable desk secrets");

const evm = read("../src/lib/custom-launch/onchain/evm.ts");
assert(evm.includes("waitForTransactionReceipt"), "EVM waits for confirmation");
assert(evm.includes("receipt.status !== \"success\""), "EVM rejects reverted receipts");
assert(evm.includes("harvestAll"), "EVM can harvest the fee router");

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

console.log(JSON.stringify({ ok: true, customLaunch: "onchain-phase-2" }));
