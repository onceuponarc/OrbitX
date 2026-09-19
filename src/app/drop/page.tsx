import type { Metadata } from "next";
import Link from "next/link";
import { viewAllCards } from "@/lib/cards/resolve";
import { loadPadMarket } from "@/lib/market";
import { formatUsd } from "@/lib/format";
import { LiveRefresh } from "@/components/pad/live-refresh";
import { ChannelStrip } from "@/components/pad/channel-strip";
import { OFFICIAL_TOKEN } from "@/lib/official-token";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Drop — launch day",
  description: "$ORBITX is live on Solana. Official CA only from @orbitx_wrld and Telegram.",
  openGraph: {
    title: "OrbitX drop",
    description: "Print a token. Print an NFT card. Let MC move both.",
    url: "/drop",
  },
};

const PLAY = [
  { n: "01", t: "Sign in with X", d: "Your desk wallet, avatar, and handle come straight from the account." },
  { n: "02", t: "Pick a chain", d: "Solana and Robinhood Chain are live. Arc is still in beta. Same desk, same flow, no wallet extension." },
  { n: "03", t: "Trade the curve", d: "Live the moment it lands. No seeded AMM required at create." },
  { n: "04", t: "Graduate", d: "Hit the target and the reserved supply seeds a deeper pool." },
];

export default async function DropPage() {
  const [{ launches, volume }, cards] = await Promise.all([loadPadMarket(), viewAllCards().catch(() => [])]);
  const live = launches.filter((row) => row.status === "live").length;

  return (
    <div className="space-y-8 lg:mx-auto lg:max-w-3xl lg:text-center">
      <LiveRefresh intervalMs={2000} />

      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold/80">Launch day</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight lg:text-6xl">The desk is open.</h1>
        <p className="mt-4 max-w-xl text-base text-white/60 lg:mx-auto">
          Launch a token on any chain. Mint an NFT card from a tweet or ticker. Card value tracks the token&apos;s
          MC — the two markets stay separate.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:justify-center lg:gap-3">
          <Link href="/launch" className="rounded-2xl bg-gold py-3 text-center text-sm font-semibold text-ink lg:rounded-full lg:px-6">
            Launch now
          </Link>
          <Link href="/cards/new" className="rounded-2xl border border-white/15 py-3 text-center text-sm lg:rounded-full lg:px-6">
            Mint a card
          </Link>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-2">
          <Stat k="Live" v={String(live)} />
          <Stat k="NFT cards" v={String(cards.length)} />
        </dl>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Token volume</p>
        <dl className="mt-1.5 grid grid-cols-3 gap-2">
          <Stat k="24h" v={formatUsd(volume.dayUsd)} />
          <Stat k="7d" v={formatUsd(volume.weekUsd)} />
          <Stat k="Total" v={formatUsd(volume.totalUsd)} />
        </dl>
      </section>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">Official channels</p>
        <div className="mt-3">
          <ChannelStrip />
        </div>
      </section>

      <section className="grid gap-3 text-left sm:grid-cols-2">
        {PLAY.map((row) => (
          <article key={row.n} className="pad-panel rounded-[1.35rem] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/35">{row.n}</p>
            <h2 className="mt-2 text-lg font-semibold">{row.t}</h2>
            <p className="mt-2 text-sm text-white/50">{row.d}</p>
          </article>
        ))}
      </section>

      <section className="pad-panel rounded-[1.35rem] px-5 py-6 text-left">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-arc/80">Official token · $ORBITX live</p>
        <p className="mt-2 text-base text-white/80">{OFFICIAL_TOKEN.liveRule}</p>
        <Link href="/params" className="mt-3 inline-block text-sm text-arc underline">
          Read the fee waterfall
        </Link>
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="pad-panel rounded-2xl px-3 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{k}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{v}</dd>
    </div>
  );
}
