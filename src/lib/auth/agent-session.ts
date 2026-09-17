import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { AGENT_EMAIL, AGENT_HANDLE } from "@/lib/auth/agent";

export const AGENT_COOKIE = "ox_agent";
const TTL_SEC = 60 * 60 * 24 * 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cookieSecret() {
  const raw =
    process.env.EMBEDDED_WALLET_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "onceupon-dev-only-change-me";
  return createHash("sha256").update(`orbitx-agent-session:${raw}`).digest();
}

function macFor(userId: string, exp: number) {
  return createHmac("sha256", cookieSecret()).update(`v1.${userId}.${exp}`).digest("hex");
}

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setAgentSessionCookie(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const store = await cookies();
  store.set(AGENT_COOKIE, `v1.${userId}.${exp}.${macFor(userId, exp)}`, cookieOpts(TTL_SEC));
}

export async function clearAgentSessionCookie() {
  const store = await cookies();
  store.set(AGENT_COOKIE, "", cookieOpts(0));
}

export async function readAgentSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(AGENT_COOKIE)?.value ?? "";
  const parts = raw.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const userId = parts[1] ?? "";
  const exp = Number(parts[2]);
  const mac = parts[3] ?? "";
  if (!UUID_RE.test(userId) || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  const expected = macFor(userId, exp);
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export function agentSessionUser(userId: string): User {
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: AGENT_EMAIL,
    app_metadata: { provider: "agent", providers: ["agent"] },
    user_metadata: { user_name: AGENT_HANDLE, preferred_username: AGENT_HANDLE },
    created_at: "2026-01-01T00:00:00.000Z",
  } as User;
}
