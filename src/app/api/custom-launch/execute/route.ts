import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { executeCustomLaunchAction } from "@/lib/custom-launch/execute";
import { assertAllowedAction } from "@/lib/custom-launch/onchain/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in before executing a strategy." }, { status: 401 });
    const body = (await request.json()) as {
      launchId?: string;
      action?: string;
      amount?: string;
      recipients?: { address: string; amount: string }[];
      minOut?: string;
    };
    if (!body.launchId || !body.action) {
      return NextResponse.json({ error: "launchId and action are required." }, { status: 400 });
    }
    assertAllowedAction(body.action);
    const result = await executeCustomLaunchAction({
      userId: user.id,
      launchId: body.launchId,
      action: body.action,
      amount: body.amount ?? "0",
      recipients: body.recipients,
      minOut: body.minOut,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Strategy execution failed." },
      { status: 400 },
    );
  }
}
