import Link from "next/link";
import { formatUsd } from "@/lib/format";

export function OrbitHero({
  liveCount,
  bondedCount,
  volumeUi,
  handle,
}: {
  liveCount: number;
  bondedCount: number;
  volumeUi: number;
  handle: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 80% 10%, rgb(29 78 216 / 14%), transparent 70%), radial-gradient(50% 50% at 10% 100%, rgb(96 165 250 / 12%), transparent 70%)",
        }}
      />
      <div className="relative z-10 p-6 sm:p-10 lg:p-14">
        <p className="text-sm text-arc/80">{handle ? `Welcome back, @${handle}` : "One desk, three chains"}</p>
        <h1 className="font-display mt-3 max-w-2xl text-[2.75rem] leading-[1.05] sm:text-6xl">
          Launch where your community already trades.
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-white/60">
          OrbitX signs every launch from an in-app desk wallet — no Phantom, no MetaMask. Solana and Robinhood
          Chain launches are fully live. Pick a chain, set your terms, and your token is tradable the moment it
          lands.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/launch"
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            Launch a token
          </Link>
          <Link
            href="/cards"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
          >
            Explore press cards
          </Link>
        </div>
        <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/10 pt-6">
          <div>
            <dt className="text-xs text-white/40">Live now</dt>
            <dd className="font-display mt-1 text-3xl">{liveCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/40">Graduated</dt>
            <dd className="font-display mt-1 text-3xl">{bondedCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/40">Volume traded</dt>
            <dd className="font-display mt-1 text-3xl text-gold">{formatUsd(volumeUi)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
