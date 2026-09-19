import { readFileSync } from "node:fs";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const hub = readFileSync(new URL("../src/app/launch/page.tsx", import.meta.url), "utf8");
const normal = readFileSync(new URL("../src/app/launch/[chain]/page.tsx", import.meta.url), "utf8");
const custom = readFileSync(new URL("../src/app/launch/[chain]/custom/page.tsx", import.meta.url), "utf8");
const schema = readFileSync(new URL("../src/lib/custom-launch/schema.ts", import.meta.url), "utf8");
const wizard = readFileSync(new URL("../src/components/custom-launch/wizard.tsx", import.meta.url), "utf8");
const deploy = readFileSync(new URL("../src/components/custom-launch/steps/deploy.tsx", import.meta.url), "utf8");
const solana = readFileSync(new URL("../src/components/launch/solana-launch-studio.tsx", import.meta.url), "utf8");
const arc = readFileSync(new URL("../src/components/launch/arc-launch-studio.tsx", import.meta.url), "utf8");
const rh = readFileSync(new URL("../src/components/launch/rh-launch-studio.tsx", import.meta.url), "utf8");

assert(hub.includes('href: "/launch/solana"'), "hub still links Solana Normal Launch");
assert(hub.includes('href: "/launch/arc"'), "hub still links Arc Normal Launch");
assert(hub.includes('href: "/launch/robinhood"'), "hub still links RH Normal Launch");
assert(hub.includes('customHref: "/launch/solana/custom"'), "hub links Solana Custom Launch");
assert(hub.includes('customHref: "/launch/arc/custom"'), "hub links Arc Custom Launch");
assert(hub.includes('customHref: "/launch/robinhood/custom"'), "hub links RH Custom Launch");
assert(hub.includes("Normal Launch"), "hub shows Normal Launch");
assert(hub.includes("Custom Launch"), "hub shows Custom Launch");
assert(hub.includes('status: "Pons v2 · live"'), "hub still marks Robinhood live");
assert(hub.includes("beta: false"), "hub Robinhood lane must not be beta");

assert(normal.includes("SolanaLaunchStudio"), "Normal Solana studio stays mounted");
assert(normal.includes("ArcLaunchStudio"), "Normal Arc studio stays mounted");
assert(normal.includes("RhLaunchStudio"), "Normal RH studio stays mounted");
assert(!normal.includes("CustomLaunch"), "Normal chain page must not mount Custom Launch");
assert(!normal.includes("/custom"), "Normal chain page must not route into Custom");

assert(custom.includes("CustomLaunchWizard"), "custom route mounts the wizard");
assert(custom.includes("isPrintableChain"), "custom route rejects unknown chains");
assert(!custom.includes("getSessionUser"), "custom route must not pull wallet session");
assert(!custom.includes("/api/"), "custom page must not call launch APIs");

for (const label of [
  "Launch Mode",
  "Token",
  "Trading Economics",
  "Primary Market",
  "Secondary Markets",
  "Automation",
  "Review",
  "Deploy",
]) {
  assert(schema.includes(`label: "${label}"`), `schema includes ${label}`);
}

assert(wizard.includes("LaunchModeStep"), "wizard renders launch mode");
assert(wizard.includes("DeployStep"), "wizard renders deploy");
assert(deploy.includes("UI foundation"), "deploy states this is UI only");
assert(deploy.includes("still not deployed"), "deploy must not claim a live print");
assert(!deploy.includes("transaction confirmed"), "deploy must not fake a confirmation");
assert(!deploy.includes("successfully deployed"), "deploy must not claim success");

assert(solana.includes('fetch("/api/solana/launch"'), "Solana Normal Launch API call stays");
assert(arc.includes('fetch("/api/arc/launch"'), "Arc Normal Launch API call stays");
assert(rh.includes('fetch("/api/rh/launch"'), "RH Normal Launch API call stays");

const modes = readFileSync(new URL("../src/lib/custom-launch/modes.ts", import.meta.url), "utf8");
const modeStep = readFileSync(new URL("../src/components/custom-launch/steps/launch-mode.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../src/components/custom-launch/strategy-preview.tsx", import.meta.url), "utf8");
const details = readFileSync(new URL("../src/components/custom-launch/mode-details.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../src/components/custom-launch/mode-card.tsx", import.meta.url), "utf8");

for (const name of [
  "Standard Custom",
  "Flywheel",
  "Bag Work",
  "Holder Rewards",
  "Charity",
  "Buyback",
  "Burn",
  "Liquidity",
  "Treasury",
  "Community",
  "Custom Strategy",
]) {
  assert(modes.includes(`name: "${name}"`), `catalog includes ${name}`);
}

assert(modes.includes("modules:"), "modes can be stacked");
assert(modes.includes("setPrimaryStrategy"), "primary strategy helper exists");
assert(modes.includes("toggleStrategyModule"), "module toggle helper exists");
assert(modes.includes("composeStrategyPreview"), "preview composition exists");
assert(modeStep.includes("StrategyPreview"), "launch mode mounts strategy preview");
assert(modeStep.includes("ModeDetails"), "launch mode mounts mode details");
assert(modeStep.includes("Add module") || card.includes("Add module"), "cards can add modules");
assert(preview.includes("Fee router"), "preview shows the fee router");
assert(preview.includes("Mock router only"), "preview must not claim execution");
assert(details.includes("These knobs only reshape the local preview"), "details stay mock");
assert(!modeStep.includes("/api/"), "launch mode must not call APIs");
assert(!modes.includes("sendTransaction"), "mode catalog must not send txs");

const { composeStrategyPreview, createLaunchModeState, setPrimaryStrategy, toggleStrategyModule } =
  await import("../src/lib/custom-launch/modes.ts");

let stack = createLaunchModeState();
assert(stack.primary === "standard", "standard is the default primary");
stack = setPrimaryStrategy(stack, "flywheel");
stack = toggleStrategyModule(stack, "holders");
stack = toggleStrategyModule(stack, "charity");
const flywheelMix = composeStrategyPreview(stack);
assert(flywheelMix.some((lane) => lane.label.toLowerCase().includes("holder")), "flywheel + holders preview updates");
assert(flywheelMix.some((lane) => lane.label.toLowerCase().includes("charity")), "flywheel + charity preview updates");
assert(flywheelMix.reduce((sum, lane) => sum + lane.bps, 0) === 10_000, "preview lanes renormalize to 100%");

stack = setPrimaryStrategy(createLaunchModeState(), "buyback");
stack = toggleStrategyModule(stack, "burn");
stack = toggleStrategyModule(stack, "liquidity");
const buybackMix = composeStrategyPreview(stack);
assert(buybackMix.length >= 3, "buyback + burn + liquidity can stack");

const protocol = readFileSync(new URL("../src/lib/custom-launch/protocol.ts", import.meta.url), "utf8");
const tokenStep = readFileSync(new URL("../src/components/custom-launch/steps/token.tsx", import.meta.url), "utf8");
const econ = readFileSync(new URL("../src/components/custom-launch/steps/trading-economics.tsx", import.meta.url), "utf8");
const fees = readFileSync(new URL("../src/lib/custom-launch/fees.ts", import.meta.url), "utf8");
const dest = "4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu";
assert(protocol.includes(dest), "OrbitX destination is centralized in protocol.ts");
assert(protocol.includes("allocationBps"), "protocol share is centralized");
assert(!tokenStep.includes(dest), "token UI must not hard-code the protocol wallet");
assert(!econ.includes(dest), "economics UI must not hard-code the protocol wallet");
assert(tokenStep.includes("TokenPreview"), "token step has a live preview");
assert(tokenStep.includes("SupplyBreakdown"), "token step has supply breakdown");
assert(econ.includes("FeeSlider"), "economics has a trading fee control");
assert(econ.includes("ProtocolDestination"), "economics shows the OrbitX destination");
assert(econ.includes("FeeAllocationBuilder"), "economics has fee allocation");
assert(econ.includes("FeeRouter"), "economics has the fee router");
assert(wizard.includes("LaunchSummary"), "wizard mounts the live summary");
assert(fees.includes("visibleFeeDestinations"), "fee destinations follow launch mode");
assert(!econ.includes("/api/"), "economics must not call APIs");

const { validateTokenConfig, createTokenConfig } = await import("../src/lib/custom-launch/token.ts");
const blank = validateTokenConfig(createTokenConfig(9));
assert(blank.name && blank.symbol && blank.imageUrl, "token validation flags missing identity");
const good = validateTokenConfig({
  ...createTokenConfig(9),
  name: "Desk Coin",
  symbol: "DESK",
  imageUrl: "https://orbitx.example/desk.png",
});
assert(Object.keys(good).length === 0, "valid token config passes");

const { createSupplyPlan, supplyAllocatedBps, supplyPlanBalanced } = await import("../src/lib/custom-launch/supply.ts");
const supply = createSupplyPlan();
assert(supplyAllocatedBps(supply) === 10_000, "default supply plan is 100%");
assert(supplyPlanBalanced(supply), "default supply plan is balanced");

const { ORBITX_PROTOCOL } = await import("../src/lib/custom-launch/protocol.ts");
assert(fees.includes('charity: ["orbitx", "creator", "charity", "holders", "liquidity"]'), "charity mode prioritizes charity lanes");
assert(fees.includes('flywheel: ["orbitx", "buyback", "liquidity", "burn", "treasury", "holders"]'), "flywheel mode prioritizes flywheel lanes");
assert(fees.includes("id === \"orbitx\""), "OrbitX allocation is locked");
assert((1000 * 300) / 10_000 === 30, "$1000 at 3% is $30 of fees");
assert(ORBITX_PROTOCOL.destination === dest, "protocol constant matches the desk wallet");

const primaryStep = readFileSync(new URL("../src/components/custom-launch/steps/primary-market.tsx", import.meta.url), "utf8");
const secondaryStep = readFileSync(new URL("../src/components/custom-launch/steps/secondary-markets.tsx", import.meta.url), "utf8");
const autoStep = readFileSync(new URL("../src/components/custom-launch/steps/automation.tsx", import.meta.url), "utf8");
const marketsSrc = readFileSync(new URL("../src/lib/custom-launch/markets.ts", import.meta.url), "utf8");
const autoSrc = readFileSync(new URL("../src/lib/custom-launch/automation.ts", import.meta.url), "utf8");
const draftSrc = readFileSync(new URL("../src/lib/custom-launch/draft.ts", import.meta.url), "utf8");

assert(marketsSrc.includes("export type PrimaryMarket"), "PrimaryMarket type exists");
assert(marketsSrc.includes("export type SecondaryMarket"), "SecondaryMarket type exists");
assert(marketsSrc.includes("export type PoolConfig"), "PoolConfig type exists");
assert(marketsSrc.includes("export type LiquidityConfig"), "LiquidityConfig type exists");
assert(marketsSrc.includes('quote: "sol"'), "default primary quote is SOL");
assert(primaryStep.includes("QuoteSelect"), "primary step has SOL/USDC cards");
assert(primaryStep.includes("PoolDesk"), "primary step has pool configuration");
assert(primaryStep.includes("LiquiditySource"), "primary step has liquidity source");
assert(primaryStep.includes("AdvancedMarket"), "primary step has advanced settings");
assert(marketsSrc.includes("Select a primary market to continue."), "primary validation copy is centralized");
assert(marketsSrc.includes("Enter a valid liquidity amount."), "liquidity validation copy is centralized");
assert(marketsSrc.includes("Complete this market or remove it."), "secondary incomplete copy is centralized");
assert(marketsSrc.includes("That market has already been added."), "duplicate pair copy is centralized");
assert(secondaryStep.includes("Add market"), "secondary step can add markets");
assert(secondaryStep.includes("MarketRouter"), "secondary step has market routing viz");
assert(!primaryStep.includes("/api/"), "primary market must not call APIs");
assert(!secondaryStep.includes("/api/"), "secondary markets must not call APIs");
assert(!primaryStep.includes("sendTransaction"), "primary market must not send txs");
assert(draftSrc.includes("orbitx.custom-launch.v4."), "draft storage is v4");

const {
  availableSecondaryQuotes,
  createMarketsConfig,
  createSecondaryMarket,
  estimatePool,
  primaryMarketComplete,
  primaryMarketError,
  secondaryMarketsComplete,
  tickerConflicts,
} = await import("../src/lib/custom-launch/markets.ts");

const markets = createMarketsConfig();
assert(markets.primary.quote === "sol", "default primary market is SOL");
assert(primaryMarketComplete(markets, "1000000000"), "default SOL pool is complete");
assert(!primaryMarketError(markets, "1000000000"), "default primary has no error");
assert(
  primaryMarketError({ ...markets, access: { ...markets.access, primaryEnabled: false } }, "1000000000") ===
    "Select a primary market to continue.",
  "disabled primary uses the required-market copy",
);
assert(
  primaryMarketError(
    { ...markets, primary: { ...markets.primary, pool: { tokenAllocation: "0", pairedAmount: "0" } } },
    "1000000000",
  ) === "Enter a valid liquidity amount.",
  "empty pool uses the liquidity copy",
);
const usdcPool = estimatePool({ tokenAllocation: "200000000", pairedAmount: "5000" }, "usdc", "1000000000");
assert(usdcPool.valid && usdcPool.pairedUsd === 5000, "USDC pool estimate uses $1 mark");
assert(usdcPool.liquidityUsd === 10_000, "UI liquidity is both sides");
const solPool = estimatePool({ tokenAllocation: "200000000", pairedAmount: "50" }, "sol", "1000000000");
assert(solPool.initialPrice === (50 * 150) / 200_000_000, "SOL initial price is paired USD / tokens");
const withBtc = { ...markets, secondary: [createSecondaryMarket("btc")] };
assert(secondaryMarketsComplete(withBtc), "configured BTC secondary is complete");
assert(!availableSecondaryQuotes(withBtc).includes("sol"), "primary quote is not a secondary option");
assert(!availableSecondaryQuotes(withBtc).includes("btc"), "added quote cannot be duplicated");
const duplicate = { ...markets, secondary: [createSecondaryMarket("usdc"), createSecondaryMarket("usdc")] };
assert(!secondaryMarketsComplete(duplicate), "duplicate secondary quotes fail validation");
const incomplete = { ...markets, secondary: [{ ...createSecondaryMarket("eth"), pool: { tokenAllocation: "", pairedAmount: "" } }] };
assert(!secondaryMarketsComplete(incomplete), "empty secondary pool fails validation");
const usdcPrimary = { ...markets, primary: { ...markets.primary, quote: "usdc" as const } };
assert(tickerConflicts(usdcPrimary, "USDC"), "primary USDC cannot be added again");
assert(
  !secondaryMarketsComplete({
    ...usdcPrimary,
    secondary: [{ ...createSecondaryMarket("other", "USDC") }],
  }),
  "custom USDC ticker colliding with primary fails",
);

assert(autoSrc.includes("export type AutomationRule"), "AutomationRule type exists");
assert(autoSrc.includes("TRIGGER_KINDS"), "trigger kinds exist");
assert(autoStep.includes("Create rule"), "automation can create rules");
assert(autoStep.includes("RuleBuilder"), "automation mounts the rule builder");
assert(autoStep.includes("MilestoneTimeline"), "automation has milestones");
assert(autoStep.includes("AutomationPreview"), "automation has simulation preview");
assert(autoStep.includes("Simulation / Preview") || autoSrc.includes("simulateRule"), "preview stays labeled as simulation");
assert(autoStep.includes("RULE_TEMPLATES"), "automation exposes templates");
assert(!autoStep.includes("/api/"), "automation must not call APIs");
assert(!autoStep.includes("sendTransaction"), "automation must not send txs");

const {
  createAutomationConfig,
  createRule,
  duplicateRule,
  moveItem,
  routeAllocatedBps,
  routesOver,
  ruleError,
  RULE_TEMPLATES,
  simulateRule,
} = await import("../src/lib/custom-launch/automation.ts");
const { createFeeConfig } = await import("../src/lib/custom-launch/fees.ts");

const mode = createLaunchModeState();
const feeConfig = createFeeConfig(mode);
const auto = createAutomationConfig();
assert(auto.rules.length === 0, "automation starts empty");
assert(auto.milestones.length >= 5, "default milestone tape exists");
const dist = RULE_TEMPLATES.find((row) => row.id === "auto_distribute")!.build(mode, feeConfig);
assert(dist.trigger === "fee_balance", "auto distribute uses fee balance");
assert(!ruleError(dist), "template rule is valid");
assert(routeAllocatedBps(dist.routes) === 10_000, "template routes total 100%");
const over = { ...dist, routes: dist.routes.map((row, index) => (index === 1 ? { ...row, bps: row.bps + 1000 } : row)) };
assert(routesOver(over.routes), "over-allocated routes are flagged");
assert(ruleError(over), "over-allocated rule cannot save");
const copy = duplicateRule(dist);
assert(copy.id !== dist.id, "duplicate gets a new id");
const reordered = moveItem(dist.actions, 0, 1);
assert(reordered[0].id === dist.actions[1].id, "actions can reorder");
const hit = simulateRule({ ...dist, status: "active" }, auto.simulation);
assert(hit.ready, "default sim fees of $127.40 trip a $100 fee rule");
const andRule = createRule(
  {
    name: "AND gate",
    trigger: "fee_balance",
    join: "and",
    conditions: [
      { id: "c1", metric: "fee_balance", op: "gte", value: "100" },
      { id: "c2", metric: "holders", op: "gte", value: "500" },
    ],
  },
  mode,
  feeConfig,
);
assert(simulateRule({ ...andRule, status: "active" }, auto.simulation).ready, "AND fee+holders hits the preview");
const orRule = createRule(
  {
    name: "OR gate",
    trigger: "market_cap",
    join: "or",
    conditions: [
      { id: "c1", metric: "market_cap", op: "gte", value: "100000" },
      { id: "c2", metric: "volume", op: "gte", value: "10000" },
    ],
  },
  mode,
  feeConfig,
);
assert(simulateRule({ ...orRule, status: "active" }, auto.simulation).ready, "OR market-cap/volume hits via volume");

console.log(JSON.stringify({ ok: true, customLaunch: "markets-automation" }));
