import Link from "next/link";
import { LaunchChainSwitch } from "@/components/launch/chain-switch";
import { RiskFeeNotice } from "@/components/launch/beta-notice";

const LANES = [
  {
    href: "/launch/arc",
    label: "Arc",
    status: "ArcPad · live",
    body: "Fixed-supply launch through ArcPad with locked liquidity. Fund the in-app Arc wallet with USDC.",
    beta: true,
  },
  {
    href: "/launch/solana",
    label: "Solana",
    status: "pump.fun · live",
    body: "Curve is live at create. Buy and sell on pump / Jupiter. Volume feeds the LP at graduation.",
    beta: false,
  },
  {
    href: "/launch/robinhood",
    label: "Robinhood Chain",
    status: "Pons v2 · beta",
    body: "Curve live at create. Trades feed it, then a locked Uniswap v4 LP. Fund the in-app RH wallet with ETH.",
    beta: true,
  },
];

export const metadata = { title: "Launch" };

export default function LaunchHubPage() {
  return (
    <div className="space-y-6">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Launch desk</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Three live venues</h1>
        <p className="mt-3 max-w-2xl text-white/55">
          Only paths that print a tradable coin. Same in-app wallet on each chain. Fund it, launch, fees come back
          here.
        </p>
        <div className="mt-5">
          <LaunchChainSwitch current="/launch" />
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {LANES.map((lane) => (
          <Link key={lane.href} href={lane.href} className="rounded-3xl border border-white/10 p-5 hover:border-white/30">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-300">{lane.status}</p>
              {lane.beta ? (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-300">
                  Beta
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{lane.label}</h2>
            <p className="mt-2 text-sm text-white/55">{lane.body}</p>
          </Link>
        ))}
      </div>
      <RiskFeeNotice />
    </div>
  );
}
