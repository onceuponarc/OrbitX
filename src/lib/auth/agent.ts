import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureDeskWallets } from "@/lib/wallets/multi";

export const AGENT_EMAIL = "oxagent@orbitx.internal";
export const AGENT_HANDLE = "oxagent";

/** SHA-256 of the operator code. Override at runtime with AGENT_LOGIN_CODE. */
const BAKED_CODE_SHA256 = "ce54ec4111e1676eba09e26787c756fc7737b53aee5d4dd3085116131651e7f1";

function sha256(value: string) {
  return createHash("sha256").update(value.normalize("NFKC").trim()).digest();
}

export function agentCodeMatches(input: string) {
  const submitted = sha256(input);
  const env = process.env.AGENT_LOGIN_CODE?.trim();
  const expected = env ? sha256(env) : Buffer.from(BAKED_CODE_SHA256, "hex");
  if (submitted.length !== expected.length) return false;
  return timingSafeEqual(submitted, expected);
}

function sessionPassword(code: string) {
  return `${sha256(`orbitx-agent-pw:${code.normalize("NFKC").trim()}`).toString("hex")}Aa1!`;
}

export async function ensureAgentAccount(code: string) {
  const service = createServiceClient();
  const password = sessionPassword(code);
  const meta = {
    user_name: AGENT_HANDLE,
    preferred_username: AGENT_HANDLE,
    full_name: "OrbitX Agent",
    name: "OrbitX Agent",
  };

  let userId: string | null = null;
  const created = await service.auth.admin.createUser({
    email: AGENT_EMAIL,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (created.data.user?.id) {
    userId = created.data.user.id;
  } else {
    const listed = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed.data.users.find((row) => row.email === AGENT_EMAIL);
    if (!existing?.id) {
      throw new Error(created.error?.message ?? "Could not create the agent account.");
    }
    userId = existing.id;
    const updated = await service.auth.admin.updateUserById(userId, { password, user_metadata: meta });
    if (updated.error) throw new Error(updated.error.message);
  }

  const profile = await service.from("users").update({
    handle: AGENT_HANDLE,
    display_name: "OrbitX Agent",
    bio: "Operator desk for launch tests.",
    is_staff: true,
  }).eq("id", userId);
  if (profile.error) {
    await service.from("users").update({
      display_name: "OrbitX Agent",
      is_staff: true,
    }).eq("id", userId);
  }

  const desk = await ensureDeskWallets(userId);
  return { userId, password, desk };
}
