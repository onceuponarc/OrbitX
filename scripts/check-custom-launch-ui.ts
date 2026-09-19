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

console.log(JSON.stringify({ ok: true, customLaunch: "ui-foundation" }));
