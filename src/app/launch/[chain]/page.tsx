import { SolanaLaunchStudio } from "@/components/launch/solana-launch-studio";
import { RhLaunchStudio } from "@/components/launch/rh-launch-studio";
import { ArcLaunchStudio } from "@/components/launch/arc-launch-studio";
import { LaunchChainSwitch } from "@/components/launch/chain-switch";
import { BetaNotice, RiskFeeNotice } from "@/components/launch/beta-notice";
import { getSessionUser } from "@/lib/auth";
import { findChain, isPrintableChain } from "@onceupon/config/solana";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ chain: string }> };

export async function generateMetadata({ params }: Props) {
  const { chain } = await params;
  const card = findChain(chain);
  return { title: card ? `Launch on ${card.title}` : "Launch" };
}

export default async function LaunchChainPage({ params }: Props) {
  const { chain } = await params;
  if (!isPrintableChain(chain)) redirect("/launch");
  const { profile } = await getSessionUser();
  const solana = chain === "solana";
  const robinhood = chain === "robinhood";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 px-5 py-7 sm:px-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/banner.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/50" />
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.jpg" alt="" className="size-12 rounded-xl border border-white/15 object-cover" />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
            Launch · {solana ? "Solana" : robinhood ? "Robinhood Chain" : "Arc"}
          </p>
        </div>
        <h1 className="relative mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {solana ? "Launch on Solana" : robinhood ? "Launch on Robinhood Chain" : "Launch on Arc"}
        </h1>
        <p className="relative mt-3 max-w-2xl text-white/60">
          {solana
            ? "pump.fun. Tradable at create. Jupiter buy/sell. Fees to your in-app Solana wallet."
            : robinhood
              ? "Pons v2. Tradable at create. Volume feeds the Uniswap v4 LP. Fees to your in-app RH wallet."
              : "Argus v4 on Arc. The launch transaction seeds the Uniswap v4 USDC pool so it does not go live at $0 liquidity. Fund the in-app wallet with the seed plus gas."}
        </p>
        <div className="relative mt-5">
          <LaunchChainSwitch
            current={solana ? "/launch/solana" : robinhood ? "/launch/robinhood" : "/launch/arc"}
          />
        </div>
      </section>
      {!solana ? <BetaNotice chain={robinhood ? "robinhood" : "arc"} /> : null}
      <RiskFeeNotice />
      {solana ? (
        <SolanaLaunchStudio handle={profile?.handle ?? null} />
      ) : robinhood ? (
        <RhLaunchStudio handle={profile?.handle ?? null} />
      ) : (
        <ArcLaunchStudio handle={profile?.handle ?? null} />
      )}
    </div>
  );
}
