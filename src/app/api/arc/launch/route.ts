import { NextResponse } from "next/server";
import { encodeAbiParameters, encodeFunctionData, parseAbiParameters } from "viem";
import { getSessionUser } from "@/lib/auth";
import { deskEvmWallet } from "@/lib/wallets/sign-desk";
import { ARC_V4, FLAUNCH_ZAP_ABI } from "@onceupon/config/ubi-v4";

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
    const { wallet, address } = await deskEvmWallet((await getSessionUser()).user?.id ?? "");
    const mode = body.engine === "onceuponers" ? "fair" : "direct";
    const supply = 1_000_000_000n * 10n ** 18n;
    const fairPercent = mode === "fair" ? 50n : 0n;
    const data = encodeFunctionData({
      abi: FLAUNCH_ZAP_ABI,
      functionName: "flaunch",
      args: [{
        name: body.title.slice(0, 32),
        symbol: body.ticker.toUpperCase().slice(0, 12),
        tokenUri: JSON.stringify({
          name: body.title,
          symbol: body.ticker.toUpperCase(),
          image: body.coverUrl || `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.orbitxtrade.world"}/brand/logo.jpg`,
          description: body.blurb ?? "",
          launchpad: "OrbitX",
          brand: "OrbitX",
          brandName: "OrbitX",
          brandUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://www.orbitxtrade.world",
          brandLogo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.orbitxtrade.world"}/brand/logo.jpg`,
          officialX: "https://x.com/orbitx_wrld",
          officialTelegram: "https://t.me/orbitx_wrld",
          creatorX: profile?.handle ? `@${profile.handle}` : "",
        }),
        initialTokenFairLaunch: (supply * fairPercent) / 100n,
        fairLaunchDuration: mode === "fair" ? 30n * 60n : 0n,
        premineAmount: 0n,
        creator: address,
        creatorFeeAllocation: 10000,
        flaunchAt: 0n,
        initialPriceParams: encodeAbiParameters(parseAbiParameters("uint256"), [6_900n * 10n ** 6n]),
        feeCalculatorParams: mode === "fair" ? encodeAbiParameters(parseAbiParameters("bool"), [true]) : "0x",
      }],
    });
    const hash = await wallet.sendTransaction({ account: wallet.account, to: ARC_V4.flaunchZap, data, chain: wallet.chain });
    return NextResponse.json({ hash, creator: address, feeRecipient: address, venue: "arc-mainnet-v4", explorer: `${ARC_V4.explorer}/tx/${hash}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Arc launch failed." },
      { status: 400 },
    );
  }
}
