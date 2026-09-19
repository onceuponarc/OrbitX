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
assert(hero.includes("hidden overflow-hidden") || hero.includes("hidden") && hero.includes("lg:block"), "home hero has a desktop layout");
assert(home.includes("lg:grid-cols-[minmax(0,1fr)_340px]"), "desktop home is a two-pane pad");
assert(css.includes("--color-gold: #d6ff3d"), "ignite lime is the brand accent");
assert(css.includes(".pad-app"), "app frame class exists");
assert(css.includes("safe-area-inset-bottom"), "mobile main clears the dock");

console.log(JSON.stringify({ ok: true, chrome: "mobile-app + desktop-web" }));
