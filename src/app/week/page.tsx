import type { Metadata } from "next";
import Link from "next/link";
import { loadPadMarket } from "@/lib/market";
import { deskScore, weekBoard } from "@/lib/feed";
import { formatUsd } from "@/lib/format";
import { TokenDeck } from "@/components/pad/token-deck";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Weekly best Chapter",
  description: "OrbitX Friday burn. 5% of pad creator fees buy the winning Chapter and burn it.",
};

export default async function WeekPage() {
  const { launches } = await loadPadMarket();
  const board = weekBoard(launches);
  const leader = board[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 px-5 py-8 text-center sm:px-10 sm:text-left">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Friday 00:00 UTC window</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Weekly best Chapter</h1>
        <p className="mt-3 max-w-2xl text-white/60">
          Score is 50% volume, 30% holders, 20% curve progress. 5% of the creator-fee slice buys the week’s winner and
          burns it. $ORBITX is live on Solana and Arc mainnet.
        </p>
      </section>

      {leader ? (
        <Link
          href={`/story/${leader.slug}`}
          className="block rounded-3xl border border-white bg-white px-5 py-6 text-black"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/45">Current lead</p>
          <p className="mt-2 text-3xl font-semibold">${leader.ticker}</p>
          <p className="text-black/50">{leader.title}</p>
          <p className="mt-2 text-sm text-black/55">
            Score {deskScore(leader).toFixed(2)} · {formatUsd(leader.volumeWeekUsd || leader.volumeUi)} 7d vol
          </p>
        </Link>
      ) : (
        <p className="rounded-3xl border border-white/10 px-5 py-10 text-center text-white/50">
          No live Chapters this window. Launch one.
        </p>
      )}

      {board.length ? <TokenDeck launches={board} /> : null}

      <ol className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10">
        {board.map((row, i) => (
          <li key={row.slug}>
            <Link href={`/story/${row.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/5">
              <span className="font-mono text-white/35">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 font-semibold">${row.ticker}</span>
              <span className="text-sm text-white/45">{formatUsd(row.volumeWeekUsd || row.volumeUi)}</span>
              <span className="font-mono text-sm tabular-nums text-white/70">{deskScore(row).toFixed(2)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
