import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hiResPortrait, publicMediaUrl, xAvatarFallback } from "@/lib/media";
import { AGENT_HANDLE } from "@/lib/auth/agent";
import { agentSessionUser, readAgentSessionUserId } from "@/lib/auth/agent-session";

export type OrbitXer = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  portraitUrl: string | null;
  isStaff: boolean;
};

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  portrait_url: string | null;
  storage_portrait_path: string | null;
  is_staff: boolean | null;
};

function toProfile(row: ProfileRow): OrbitXer {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    portraitUrl:
      hiResPortrait(row.portrait_url) ??
      publicMediaUrl(row.portrait_url) ??
      xAvatarFallback(row.handle) ??
      "/brand/logo.jpg",
    isStaff: Boolean(row.is_staff),
  };
}

function fallbackAgentProfile(userId: string): OrbitXer {
  return {
    id: userId,
    handle: AGENT_HANDLE,
    displayName: "OrbitX Agent",
    bio: "Operator desk for launch tests.",
    portraitUrl: "/brand/logo.jpg",
    isStaff: true,
  };
}

async function profileFor(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("users")
    .select("id, handle, display_name, bio, portrait_url, storage_portrait_path, is_staff")
    .eq("id", userId)
    .maybeSingle();
  return data ? toProfile(data as ProfileRow) : null;
}

async function profileViaService(userId: string) {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("users")
      .select("id, handle, display_name, bio, portrait_url, storage_portrait_path, is_staff")
      .eq("id", userId)
      .maybeSingle();
    return data ? toProfile(data as ProfileRow) : null;
  } catch (error) {
    console.error("agent profile load failed", error);
    return null;
  }
}

async function fromAgentCookie(): Promise<{ user: User; profile: OrbitXer } | null> {
  const userId = await readAgentSessionUserId();
  if (!userId) return null;
  const profile = (await profileViaService(userId)) ?? fallbackAgentProfile(userId);
  return { user: agentSessionUser(userId), profile };
}

export async function getSessionUser() {
  try {
    const agent = await fromAgentCookie();
    if (agent) return agent;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null, profile: null as OrbitXer | null };

    const profile = (await profileFor(user.id, supabase)) ?? (await profileViaService(user.id));
    return { user, profile };
  } catch (error) {
    console.error("getSessionUser failed", error);
    try {
      const agent = await fromAgentCookie();
      if (agent) return agent;
    } catch {
      /* cookie parse */
    }
    return { user: null, profile: null as OrbitXer | null };
  }
}

export function originFromHeaders(headers: Headers) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:43147";
}
