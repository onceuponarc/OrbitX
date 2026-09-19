import { readFileSync } from "node:fs";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const files = {
  tradePanel: readFileSync(new URL("../src/components/token/trade-panel.tsx", import.meta.url), "utf8"),
  swapPanel: readFileSync(new URL("../src/components/jupiter/swap-panel.tsx", import.meta.url), "utf8"),
  curveTrade: readFileSync(new URL("../src/components/pad/curve-trade.tsx", import.meta.url), "utf8"),
  evmTrade: readFileSync(new URL("../src/components/token/evm-trade.tsx", import.meta.url), "utf8"),
  claimDesk: readFileSync(new URL("../src/components/claimfee/claim-fee-desk.tsx", import.meta.url), "utf8"),
  claimButton: readFileSync(new URL("../src/components/token/claim-fees-button.tsx", import.meta.url), "utf8"),
  claimHelper: readFileSync(new URL("../src/lib/http/claim-creator-fees.ts", import.meta.url), "utf8"),
  linkLp: readFileSync(new URL("../src/components/story/link-lp.tsx", import.meta.url), "utf8"),
  providers: readFileSync(new URL("../src/components/providers.tsx", import.meta.url), "utf8"),
  tradeSwap: readFileSync(new URL("../src/app/api/trade/swap/route.ts", import.meta.url), "utf8"),
  jupiterExec: readFileSync(new URL("../src/app/api/jupiter/execute/route.ts", import.meta.url), "utf8"),
};

for (const [name, source] of Object.entries(files)) {
  assert(!source.includes("SolanaConnectButton"), `${name} still mounts Connect wallet`);
  assert(!source.includes("useWalletSigner"), `${name} still signs with a browser wallet`);
  assert(!/Connect a Solana wallet/i.test(source), `${name} still asks to connect a wallet`);
}

assert(files.tradePanel.includes('/api/trade/swap'), "token trades must POST the desk swap");
assert(files.tradePanel.includes("in-app Solana desk"), "token trades must say desk wallet");
assert(files.swapPanel.includes("/api/jupiter/execute"), "jupiter panel must execute on the desk");
assert(files.curveTrade.includes("/api/stories/") && files.curveTrade.includes("/trade"), "curve trades must POST the desk trade route");
assert(files.claimDesk.includes("postClaimCreatorFees") || files.claimDesk.includes("/api/solana/claim"), "fee claims must hit the desk claim route");
assert(files.claimHelper.includes("/api/solana/claim"), "claim helper must POST the desk claim route");
assert(files.claimButton.includes("postClaimCreatorFees"), "story claim button must use the desk helper");
assert(!files.providers.includes("SolanaWalletProvider"), "app shell must not wrap Phantom");
assert(files.tradeSwap.includes("deskSolanaKey"), "desk swap must sign with the in-app key");
assert(files.jupiterExec.includes("deskSolanaKey"), "jupiter execute must sign with the in-app key");
assert(files.evmTrade.includes("in-app desk"), "evm trades must use the in-app desk");

console.log(JSON.stringify({ ok: true, surfaces: Object.keys(files) }));
