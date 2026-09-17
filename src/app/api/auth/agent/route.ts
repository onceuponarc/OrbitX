import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AGENT_EMAIL, agentCodeMatches, ensureAgentAccount } from "@/lib/auth/agent";
import { setAgentSessionCookie } from "@/lib/auth/agent-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function trySupabaseMagicSession() {
  const service = createServiceClient();
  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => undefined);
  const generated = await service.auth.admin.generateLink({
    type: "magiclink",
    email: AGENT_EMAIL,
  });
  const props = generated.data?.properties;
  if (!props) return false;
  if (props.hashed_token) {
    const hashed = await supabase.auth.verifyOtp({
      token_hash: props.hashed_token,
      type: "magiclink",
    });
    if (!hashed.error) return true;
  }
  if (props.email_otp) {
    const otp = await supabase.auth.verifyOtp({
      email: AGENT_EMAIL,
      token: props.email_otp,
      type: "magiclink",
    });
    if (!otp.error) return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    const code = (body.code ?? "").trim();
    if (!code) return NextResponse.json({ error: "Enter the agent code." }, { status: 400 });
    if (!agentCodeMatches(code)) {
      return NextResponse.json({ error: "That agent code is not valid." }, { status: 401 });
    }
    const { userId, desk } = await ensureAgentAccount(code);
    await setAgentSessionCookie(userId);
    try {
      await trySupabaseMagicSession();
    } catch (error) {
      console.error("agent magic-link session skipped", error);
    }
    return NextResponse.json({
      ok: true,
      handle: "oxagent",
      wallets: desk.wallets,
      explorers: desk.explorers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent sign-in failed." },
      { status: 400 },
    );
  }
}
