import { readFileSync } from "node:fs";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const agent = readFileSync(new URL("../src/lib/auth/agent.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/auth/agent/route.ts", import.meta.url), "utf8");
const form = readFileSync(new URL("../src/components/auth/agent-code-form.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../src/app/auth/login/page.tsx", import.meta.url), "utf8");

assert(agent.includes("timingSafeEqual"), "agent code compare must be constant-time");
assert(/BAKED_CODE_SHA256 = "[0-9a-f]{64}"/.test(agent), "baked agent code must be a sha256 hex digest");
assert(!agent.includes("oxa-"), "agent source must not contain the plaintext code");
assert(route.includes("agentCodeMatches"), "agent route must check the code");
assert(route.includes("ensureAgentAccount"), "agent route must create the operator account");
assert(route.includes("ensureDeskWallets") || agent.includes("ensureDeskWallets"), "agent login must open desk wallets");
assert(form.includes("/api/auth/agent"), "login form must POST the agent route");
assert(login.includes("AgentCodeForm"), "login page must mount the agent code form");

console.log(JSON.stringify({ ok: true, agentLogin: true }));
