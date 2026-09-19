import { readFileSync } from "node:fs";
import { vaultsHaveClaimableFees } from "../src/lib/solana/claim-fees-util.ts";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

assert(!vaultsHaveClaimableFees([]), "empty vault list is not claimable");
assert(!vaultsHaveClaimableFees([{ total: { isZero: () => true } }]), "zero vault is not claimable");
assert(
  vaultsHaveClaimableFees([{ total: { isZero: () => true } }, { total: { isZero: () => false } }]),
  "any non-zero vault is claimable",
);

const files = {
  route: readFileSync(new URL("../src/app/api/solana/claim/route.ts", import.meta.url), "utf8"),
  claim: readFileSync(new URL("../src/lib/solana/claim-fees.ts", import.meta.url), "utf8"),
  portal: readFileSync(new URL("../src/lib/solana/pumpportal.ts", import.meta.url), "utf8"),
  helper: readFileSync(new URL("../src/lib/http/claim-creator-fees.ts", import.meta.url), "utf8"),
  button: readFileSync(new URL("../src/components/token/claim-fees-button.tsx", import.meta.url), "utf8"),
  desk: readFileSync(new URL("../src/components/claimfee/claim-fee-desk.tsx", import.meta.url), "utf8"),
  studio: readFileSync(new URL("../src/components/launch/solana-launch-studio.tsx", import.meta.url), "utf8"),
  signDesk: readFileSync(new URL("../src/lib/wallets/sign-desk.ts", import.meta.url), "utf8"),
  vanityBrowser: readFileSync(new URL("../src/lib/solana/vanity-browser.ts", import.meta.url), "utf8"),
};

assert(files.route.includes("collectCreatorFeeTransaction"), "claim route must build from on-chain vaults");
assert(files.route.includes("confirmMs"), "claim route must cap confirmation so the request cannot hang");
assert(files.claim.includes("getCreatorVaultQuoteBalances"), "claim must read vaults before sending");
assert(files.claim.includes("Nothing to claim right now."), "empty vaults must fail fast");
assert(files.portal.includes("AbortSignal.timeout"), "PumpPortal collect must time out");
assert(files.helper.includes("AbortSignal.timeout"), "client claim fetch must time out");
assert(files.button.includes("postClaimCreatorFees"), "story button must use the timed claim helper");
assert(files.desk.includes("postClaimCreatorFees"), "claim desk must use the timed claim helper");
assert(files.studio.includes("postClaimCreatorFees"), "launch studio must use the timed claim helper");
assert(files.studio.includes("finally"), "studio claim must always clear busy");
assert(files.studio.indexOf("</form>") < files.studio.indexOf("<ClaimFees"), "claim button must sit outside the launch form");
assert(files.signDesk.includes("confirmMs"), "desk send must accept a confirm timeout");
assert(files.signDesk.includes('"auto"'), "desk send must accept auto versioned/legacy txs");
assert(
  files.vanityBrowser.includes("requestIdleCallback") && files.vanityBrowser.includes("setTimeout"),
  "browser vanity grind must yield so Claim fees cannot lock the launch tab",
);

console.log(JSON.stringify({ ok: true, emptyVaults: false, timedClient: true }));
