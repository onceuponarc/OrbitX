import { readFileSync } from "node:fs";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const files = {
  hub: readFileSync(new URL("../src/app/launch/page.tsx", import.meta.url), "utf8"),
  chain: readFileSync(new URL("../src/app/launch/[chain]/page.tsx", import.meta.url), "utf8"),
  studio: readFileSync(new URL("../src/components/launch/rh-launch-studio.tsx", import.meta.url), "utf8"),
  banner: readFileSync(new URL("../src/components/pad/chain-status-banner.tsx", import.meta.url), "utf8"),
  notice: readFileSync(new URL("../src/components/launch/beta-notice.tsx", import.meta.url), "utf8"),
  hero: readFileSync(new URL("../src/components/pad/orbit-hero.tsx", import.meta.url), "utf8"),
  config: readFileSync(new URL("../packages/config/src/solana.ts", import.meta.url), "utf8"),
};

assert(files.hub.includes('status: "Pons v2 · live"'), "launch hub must mark Robinhood live");
assert(files.hub.includes("beta: false"), "launch hub Robinhood lane must not be beta");
assert(!/status: "Pons v2 · beta"/.test(files.hub), "launch hub must not say Robinhood is beta");
assert(files.chain.includes("Fully live, out of beta"), "RH launch page must say it is live");
assert(files.chain.includes('BetaNotice chain="arc"'), "only Arc keeps the beta notice");
assert(!files.chain.includes("robinhood ? \"robinhood\""), "RH launch page must not mount a RH beta notice");
assert(files.studio.includes("fully live and out of beta"), "RH studio must say launches are live");
assert(files.banner.includes("Robinhood live"), "site banner must say RH is live");
assert(files.banner.includes("Arc beta"), "site banner must keep Arc in beta");
assert(!files.banner.includes("Arc &amp; Robinhood Chain are in beta"), "banner must not group RH with Arc beta");
assert(files.notice.includes("Solana and Robinhood Chain are live"), "Arc beta notice must say RH is live");
assert(files.hero.includes("Robinhood"), "home hero must mention live Robinhood launches");
assert(files.config.includes("Pons v2 · live"), "chain config badge must say RH is live");
assert(!files.config.includes("Spot · no curve"), "RH config must not advertise a no-curve spot print");

console.log(JSON.stringify({ ok: true, robinhood: "live" }));
