import Link from "next/link";
import { RiskFeeNotice } from "@/components/launch/beta-notice";
import { cn } from "@/lib/utils";

const LANES = [
  {
    href: "/launch/solana",
    customHref: "/launch/solana/custom",
    label: "Solana",
    short: "SOLANA",
    status: "pump.fun · live",
    body: "Curve is live at create. Buy and sell on pump / Jupiter. Volume feeds the LP at graduation.",
    beta: false,
  },
  {
    href: "/launch/arc",
    customHref: "/launch/arc/custom",
    label: "Arc",
    short: "ARC",
    status: "Argus · live",
    body: "Fixed-supply Argus v4. The desk seeds the Uniswap v4 USDC pool in the same transaction.",
    beta: true,
  },
  {
    href: "/launch/robinhood",
    customHref: "/launch/robinhood/custom",
    label: "RH",
    short: "RH",
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
        <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">Choose a chain</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55 lg:text-base">
          Every venue has two desks. Normal Launch is the live print you already use. Custom Launch
          is the advanced control surface for economics, markets, and automation — UI only in this
          phase.
        </p>
      </section>
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {LANES.map((lane) => (
          <article key={lane.href} className="ox-console rounded-[1.4rem] p-5">
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
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">{lane.short}</h2>
            <p className="mt-1 text-sm text-white/45">{lane.label}</p>
            <p className="mt-2 text-sm text-white/55">{lane.body}</p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                href={lane.href}
                className="rounded-2xl border border-white/15 bg-white px-3 py-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-gold"
              >
                Normal Launch
              </Link>
              <Link
                href={lane.customHref}
                className={cn(
                  "rounded-2xl border border-gold/35 bg-gold/10 px-3 py-3 text-center text-sm font-semibold text-gold",
                  "transition-colors hover:border-gold hover:bg-gold/20",
                )}
              >
                Custom Launch
              </Link>
            </div>
          </article>
        ))}
      </div>
      <RiskFeeNotice />
    </div>
  );
}
