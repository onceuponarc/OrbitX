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
  const [{ launches }, cards] = await Promise.all([loadPadMarket(), viewAllCards().catch(() => [])]);
  const live = launches.filter((row) => row.status === "live").length;
  const volume = launches.reduce((sum, row) => sum + row.volumeUi, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-10 text-center">
      <LiveRefresh intervalMs={2000} />

      <section className="pt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">OrbitX · launch day</p>
        <h1 className="font-display mt-4 text-4xl leading-tight sm:text-6xl">The desk is open.</h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-white/60">
          Launch a token on any chain. Mint an NFT card from a tweet or ticker. Card value tracks the token&apos;s
          MC — the two markets stay separate.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/launch" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">
            Launch now
          </Link>
          <Link href="/cards/new" className="rounded-full border border-white/25 px-6 py-3 text-sm">
            Mint an NFT card
          </Link>
        </div>
        <dl className="mx-auto mt-8 grid max-w-sm grid-cols-3 gap-3">
          <Stat k="Live" v={String(live)} />
          <Stat k="Volume" v={formatUsd(volume)} />
          <Stat k="NFT cards" v={String(cards.length)} />
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
          <article key={row.n} className="rounded-3xl border border-white/10 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/35">{row.n}</p>
            <h2 className="mt-2 text-lg font-semibold">{row.t}</h2>
            <p className="mt-2 text-sm text-white/50">{row.d}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-arc/25 bg-arc/[0.05] px-5 py-6 text-left">
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
    <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{k}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{v}</dd>
    </div>
  );
}
