import { readFileSync } from "node:fs";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const shell = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const tabs = readFileSync(new URL("../src/components/pad/tab-bar.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/pad/pad-sidebar.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../src/components/site-footer.tsx", import.meta.url), "utf8");
const hero = readFileSync(new URL("../src/components/pad/orbit-hero.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

assert(shell.includes("PadSidebar"), "desktop must mount a sidebar");
assert(shell.includes("pad-main"), "content must use the dual pad-main frame");
assert(shell.includes("lg:flex-row"), "desktop chrome must sit beside the sidebar");
assert(tabs.includes("lg:hidden"), "tab bar is the mobile app dock");
assert(tabs.includes('href: "/trade"') || tabs.includes('"/trade"'), "mobile tabs include Trade");
assert(tabs.includes('href: "/wallet"') || tabs.includes('"/wallet"'), "mobile tabs include Wallet");
assert(tabs.includes("bg-gold"), "launch tab is the raised ignite control");
assert(header.includes("lg:hidden"), "mobile gets a compact app header");
assert(header.includes("hidden h-14") || header.includes("hidden") && header.includes("lg:flex"), "desktop gets a separate top bar");
assert(sidebar.includes("hidden") && sidebar.includes("lg:flex"), "sidebar is desktop-only");
assert(footer.includes("hidden") && footer.includes("lg:block"), "website footer stays off mobile");
assert(hero.includes("lg:hidden"), "home hero has a mobile app layout");
assert(hero.includes("hidden overflow-hidden") || (hero.includes("hidden") && hero.includes("lg:block")), "home hero has a desktop layout");
assert(hero.includes("24h"), "hero shows 24h token volume");
assert(hero.includes("7d"), "hero shows 7d token volume");
assert(hero.includes("Total"), "hero shows lifetime token volume");
assert(hero.includes("volumeDayUsd"), "hero receives split volume stats");
assert(home.includes("volume.dayUsd"), "home passes 24h volume from the pad market");
assert(home.includes("volume.weekUsd"), "home passes 7d volume from the pad market");
assert(home.includes("volume.totalUsd"), "home passes total volume from the pad market");
assert(home.includes("lg:grid-cols-[minmax(0,1fr)_340px]"), "desktop home is a two-pane pad");
assert(css.includes("--color-gold: #d6ff3d"), "ignite lime is the brand accent");
assert(css.includes(".pad-app"), "app frame class exists");
assert(css.includes("safe-area-inset-bottom"), "mobile main clears the dock");

const refresh = readFileSync(new URL("../src/components/pad/live-refresh.tsx", import.meta.url), "utf8");
assert(!home.includes("intervalMs={2000}"), "home must not full-refresh every 2s");
assert(refresh.includes("pointerdown"), "live refresh yields to clicks");
assert(refresh.includes("inflight"), "live refresh must not stack RSC payloads");
assert(refresh.includes("12_000") || refresh.includes("12000"), "default poll is 12s, not 2s");

assert(!home.includes("CardRail"), "home must not show press-card NFTs");
assert(!home.includes("/cards"), "home shortcuts must not link to cards");
assert(home.includes("$ORBITX"), "home still points at official $ORBITX");

const urls = readFileSync(new URL("../packages/config/src/urls.ts", import.meta.url), "utf8");
assert(urls.includes('PUBLIC_SITE_URL = "https://www.orbitxtrade.world"'), "canonical pad is orbitxtrade.world");
assert(urls.includes("LEGACY_LAUNCHPAD_URL"), "old orbitxlaunch URL is kept, not deleted");
assert(urls.includes("https://www.orbitx.world/orbitxlaunch"), "legacy URL stays in config only");

const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
assert(nextConfig.includes('source: "/orbitxlaunch"'), "old /orbitxlaunch path is hidden behind a redirect");
assert(nextConfig.includes('destination: "/"'), "old launch path lands on the new pad");

assert(footer.includes("Launchpad"), "footer labels the new pad");
assert(!footer.includes("orbitx.world/orbitxlaunch"), "footer must not link the old launch pad");

const links = readFileSync(new URL("../src/components/links/share-deck.tsx", import.meta.url), "utf8");
assert(links.includes("PUBLIC_SITE_URL"), "share deck uses the new pad URL");
assert(!links.includes("orbitx.world/orbitxlaunch"), "share deck must not link the old launch pad");

const feed = readFileSync(new URL("../src/lib/feed.ts", import.meta.url), "utf8");
assert(feed.includes("cursor-agent-p29a"), "hides the CAGT test launch");
assert(feed.includes("cate-yk9e"), "hides today's $CATE test launch");
assert(feed.includes("shielded-cat-gz90"), "hides the Shielded Cat test launch");
assert(feed.includes("pons-s1eb"), "hides the Pons test launch");
assert(feed.includes("isOfficialLaunch"), "test hides never apply to $ORBITX");
assert(feed.includes("OFFICIAL_LAUNCH_SLUG"), "official $ORBITX is a board row");
assert(feed.includes("officialFeedLaunch"), "builds the live $ORBITX feed row");

const cards = readFileSync(new URL("../src/lib/cards/resolve.ts", import.meta.url), "utf8");
assert(cards.includes("PUBLIC_PRESS_CARDS = false"), "public NFTs stay hidden");

console.log(JSON.stringify({ ok: true, chrome: "mobile-app + desktop-web" }));
