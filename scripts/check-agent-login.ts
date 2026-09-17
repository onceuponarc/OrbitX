import { readFileSync } from "node:fs";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const agent = readFileSync(new URL("../src/lib/auth/agent.ts", import.meta.url), "utf8");
const session = readFileSync(new URL("../src/lib/auth/agent-session.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/auth/agent/route.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
const logout = readFileSync(new URL("../src/app/auth/logout/route.ts", import.meta.url), "utf8");
const form = readFileSync(new URL("../src/components/auth/agent-code-form.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../src/app/auth/login/page.tsx", import.meta.url), "utf8");

assert(agent.includes("timingSafeEqual"), "agent code compare must be constant-time");
assert(/BAKED_CODE_SHA256 = "[0-9a-f]{64}"/.test(agent), "baked agent code must be a sha256 hex digest");
assert(!agent.includes("oxa-"), "agent source must not contain the plaintext code");
assert(session.includes("ox_agent"), "agent session cookie must be named");
assert(session.includes("createHmac"), "agent session cookie must be HMAC-signed");
assert(route.includes("agentCodeMatches"), "agent route must check the code");
assert(route.includes("ensureAgentAccount"), "agent route must create the operator account");
assert(route.includes("setAgentSessionCookie"), "agent route must set the HMAC session cookie");
assert(route.includes("generateLink"), "agent route must try admin magic-link when email is allowed");
assert(!route.includes("signInWithPassword"), "agent route must not use email/password (disabled in prod)");
assert(auth.includes("readAgentSessionUserId"), "getSessionUser must honor the agent cookie");
assert(logout.includes("clearAgentSessionCookie"), "logout must drop the agent cookie");
assert(route.includes("desk.wallets"), "agent login must return desk wallets even if supabase session fails");
assert(agent.includes("ensureDeskWallets"), "agent login must open desk wallets");
assert(form.includes("/api/auth/agent"), "login form must POST the agent route");
assert(login.includes("AgentCodeForm"), "login page must mount the agent code form");

console.log(JSON.stringify({ ok: true, agentLogin: true, session: "hmac-cookie" }));
