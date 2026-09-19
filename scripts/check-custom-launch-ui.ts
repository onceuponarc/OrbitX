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

console.log(JSON.stringify({ ok: true, customLaunch: "token-economics" }));
