import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { launchWithPar } from "@/lib/par/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { profile } = await getSessionUser();
    const body = (await request.json()) as {
      title?: string;
      ticker?: string;
      blurb?: string;
      engine?: "author" | "onceuponers";
      authorBps?: number;
      graduateUi?: number;
      coverUrl?: string | null;
      rightsAttested?: boolean;
      creator?: string;
    };
    if (!body.title || !body.ticker) {
      return NextResponse.json({ error: "Name and ticker are required." }, { status: 400 });
    }
    if (!body.rightsAttested) {
      return NextResponse.json({ error: "Attest you have the rights to the art and name." }, { status: 400 });
    }
    const creator = body.creator?.startsWith("0x")
      ? (body.creator as `0x${string}`)
      : undefined;
    if (!creator) {
      return NextResponse.json({ error: "Connect an EVM creator wallet for Par launches." }, { status: 400 });
    }
    const result = await launchWithPar({
      network: "arc",
      name: body.title,
      symbol: body.ticker,
      description: body.blurb ?? "",
      logo: body.coverUrl ?? "",
      twitter: profile?.handle ? `https://x.com/${profile.handle}` : "",
      creator,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Arc launch failed." },
      { status: 400 },
    );
  }
}
