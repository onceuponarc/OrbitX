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
    <section className="pad-fade">
      <div className="lg:hidden">
        <p className="text-xs text-white/45">{handle ? `Hey @${handle}` : "In-app desk · three chains"}</p>
        <h1 className="mt-1 text-[1.85rem] font-semibold leading-[1.05] tracking-tight">
          The pad is <span className="text-gold">live</span>
        </h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Live" value={String(liveCount)} />
          <Stat label="Graduated" value={String(bondedCount)} />
          <Stat label="Volume" value={formatUsd(volumeUi)} accent />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/launch" className="rounded-2xl bg-gold py-3 text-center text-sm font-semibold text-ink">
            Launch
          </Link>
          <Link
            href="/trade"
            className="rounded-2xl border border-white/12 bg-white/5 py-3 text-center text-sm font-semibold text-white"
          >
            Trade
          </Link>
        </div>
      </div>

      <div className="pad-panel relative hidden overflow-hidden rounded-[1.6rem] lg:block">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(214,255,61,0.14),transparent_55%),radial-gradient(50%_70%_at_0%_100%,rgba(255,90,31,0.12),transparent_60%)]" />
        <div className="relative grid gap-8 p-8 xl:grid-cols-[minmax(0,1.4fr)_auto] xl:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">
              {handle ? `Welcome back @${handle}` : "Launch control"}
            </p>
            <h1 className="mt-3 max-w-xl text-5xl font-semibold tracking-tight">
              Launch where the tape is already moving.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/55">
              OrbitX signs every launch from an in-app desk. Solana and Robinhood Chain are live. Arc is in beta.
              No Phantom. No MetaMask popup.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/launch" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink">
                Launch a token
              </Link>
              <Link
                href="/cards"
                className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white"
              >
                Press cards
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-6">
            <div>
              <dt className="text-xs text-white/40">Live now</dt>
              <dd className="mt-1 text-4xl font-semibold tracking-tight">{liveCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Graduated</dt>
              <dd className="mt-1 text-4xl font-semibold tracking-tight">{bondedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Volume</dt>
              <dd className="mt-1 text-4xl font-semibold tracking-tight text-gold">{formatUsd(volumeUi)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="pad-panel rounded-2xl px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${accent ? "text-gold" : "text-white"}`}>{value}</p>
    </div>
  );
}
