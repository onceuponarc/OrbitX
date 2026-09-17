import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { agentCodeMatches, ensureAgentAccount, AGENT_EMAIL } from "@/lib/auth/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    const code = (body.code ?? "").trim();
    if (!code) return NextResponse.json({ error: "Enter the agent code." }, { status: 400 });
    if (!agentCodeMatches(code)) {
      return NextResponse.json({ error: "That agent code is not valid." }, { status: 401 });
    }
    const { password, desk } = await ensureAgentAccount(code);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: AGENT_EMAIL, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
