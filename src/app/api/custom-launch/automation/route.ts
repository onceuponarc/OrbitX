import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadLaunchById, loadRules, touchRule } from "@/lib/custom-launch/persist";
import { executeCustomLaunchAction } from "@/lib/custom-launch/execute";
import { cooldownOpen, executableActions, ruleConditionsMet, type LiveReadings } from "@/lib/custom-launch/engine";
import type { AutomationRule } from "@/lib/custom-launch/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in to run automation." }, { status: 401 });
    const body = (await request.json()) as { launchId?: string; readings?: Partial<LiveReadings>; amount?: string };
    if (!body.launchId) return NextResponse.json({ error: "launchId is required." }, { status: 400 });
    const launch = await loadLaunchById(body.launchId);
    if (!launch) return NextResponse.json({ error: "Custom Launch not found." }, { status: 404 });
    if (launch.author_user_id !== user.id) return NextResponse.json({ error: "Only the creator can run automation." }, { status: 403 });
    const rules = await loadRules(launch.id);
    const live: LiveReadings = {
      feeBalance: Number(body.readings?.feeBalance ?? 0),
      marketCap: Number(body.readings?.marketCap ?? 0),
      volume: Number(body.readings?.volume ?? 0),
      holders: Number(body.readings?.holders ?? 0),
      liquidity: Number(body.readings?.liquidity ?? 0),
      now: Date.now(),
    };
    const ran: { ruleId: string; action: string; result?: unknown; error?: string }[] = [];
    for (const row of rules) {
      const config = row.config as AutomationRule;
      if (!config || row.status !== "active") continue;
      if (!ruleConditionsMet({ ...config, status: "active" }, live)) continue;
      if (!cooldownOpen(row.last_executed_at, row.cooldown_seconds ?? 0)) continue;
      const actions = executableActions(config);
      for (const action of actions) {
        try {
          const amount = body.amount || String(Math.floor(Number(row.max_execution || live.feeBalance || 0)));
          const result = await executeCustomLaunchAction({
            userId: user.id,
            launchId: launch.id,
            action,
            amount,
            ruleId: row.id,
          });
          await touchRule(row.id);
          ran.push({ ruleId: row.id, action, result });
        } catch (error) {
          ran.push({
            ruleId: row.id,
            action,
            error: error instanceof Error ? error.message : "Automation action failed.",
          });
        }
      }
    }
    return NextResponse.json({ ran });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Automation tick failed." },
      { status: 400 },
    );
  }
}
