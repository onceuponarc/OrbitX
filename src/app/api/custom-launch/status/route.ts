import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  loadAuthorExecutions,
  loadLaunchById,
  loadLaunchBySlug,
  loadPublicExecutions,
  loadRules,
  loadSplits,
  loadVaults,
  publicLaunchView,
} from "@/lib/custom-launch/persist";
import { customLaunchAdapter, enabledExecuteActions } from "@/lib/custom-launch/onchain";
import { protocolDestinationForChain } from "@/lib/custom-launch/onchain/validate";
import { liveReadingsForLaunch, syncLaunchVaults } from "@/lib/custom-launch/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const slug = url.searchParams.get("slug");
    if (!id && !slug) return NextResponse.json({ error: "id or slug is required." }, { status: 400 });
    const launch = id ? await loadLaunchById(id) : await loadLaunchBySlug(slug!);
    if (!launch) return NextResponse.json({ error: "Custom Launch not found." }, { status: 404 });
    const { user } = await getSessionUser();
    const isAuthor = Boolean(user && user.id === launch.author_user_id);
    if (launch.status !== "live" && launch.status !== "paused" && launch.status !== "graduated" && !isAuthor) {
      return NextResponse.json({ error: "Custom Launch not found." }, { status: 404 });
    }
    const publicView = await publicLaunchView(launch);
    const activity = await loadPublicExecutions(launch.id);
    const caps = customLaunchAdapter(launch.chain).capabilities();
    if (!isAuthor) {
      return NextResponse.json({ launch: publicView, activity, capabilities: caps, author: false });
    }
    const vaults = await syncLaunchVaults(launch).catch(() => loadVaults(launch.id));
    const [splits, rules, executions, readings] = await Promise.all([
      loadSplits(launch.id),
      loadRules(launch.id),
      loadAuthorExecutions(launch.id),
      liveReadingsForLaunch(launch, vaults),
    ]);
    return NextResponse.json({
      launch: publicView,
      activity,
      capabilities: caps,
      author: true,
      vaults,
      splits,
      rules,
      executions,
      readings,
      enabledActions: enabledExecuteActions(launch.config.mode, launch.config),
      destinations: {
        creator: launch.creator_address,
        charity: launch.charity_address,
        treasury: launch.treasury_address,
        community: launch.community_address,
        protocol: protocolDestinationForChain(launch.chain),
        hub: launch.hub_address,
        router: launch.router_address,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load Custom Launch." },
      { status: 400 },
    );
  }
}
