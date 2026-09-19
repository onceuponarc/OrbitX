import Link from "next/link";
import { LaunchChainSwitch } from "@/components/launch/chain-switch";
import { RiskFeeNotice } from "@/components/launch/beta-notice";

const LANES = [
  {
    href: "/launch/arc",
    label: "Arc",
    status: "Argus · live",
    body: "Fixed-supply Argus v4. The desk seeds the Uniswap v4 USDC pool in the same transaction.",
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
    status: "Pons v2 · live",
    body: "Fully live, out of beta. Curve live at create. Fund the in-app RH wallet with ETH.",
    beta: false,
  },
];

export const metadata = { title: "Launch" };

export default function LaunchHubPage() {
  return (
    <div className="space-y-5">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">Launch desk</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">Pick a venue</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55 lg:text-base">
          Only paths that print a tradable coin. Same in-app wallet on each chain.
        </p>
        <div className="mt-4">
          <LaunchChainSwitch current="/launch" />
        </div>
      </section>
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {LANES.map((lane) => (
          <Link key={lane.href} href={lane.href} className="pad-panel rounded-[1.4rem] p-5 hover:border-gold/35">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-arc">{lane.status}</p>
              {lane.beta ? (
                <span className="rounded-full bg-heat/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-heat">
                  Beta
                </span>
              ) : (
                <span className="rounded-full bg-buy/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-buy">
                  Live
                </span>
              )}
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">{lane.label}</h2>
            <p className="mt-2 text-sm text-white/55">{lane.body}</p>
          </Link>
        ))}
      </div>
      <RiskFeeNotice />
    </div>
  );
}
