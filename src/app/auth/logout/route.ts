import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { originFromHeaders } from "@/lib/auth";
import { clearAgentSessionCookie } from "@/lib/auth/agent-session";

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearAgentSessionCookie();
  return NextResponse.redirect(originFromHeaders(request.headers));
}
