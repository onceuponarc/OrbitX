import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in before trading." }, { status: 401 });
    return NextResponse.json({ error: "Arc launches now use Argus v4. The old ArcPad v3 router is disabled; Argus trades must use its UniversalRouter v4 command path and the launch-specific pool id/hook." }, { status: 501 });
  } catch {
    return NextResponse.json({ error: "Arc trade route unavailable." }, { status: 500 });
  }
}
