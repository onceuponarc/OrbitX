import Link from "next/link";
import type { FeedLaunch } from "@/lib/feed";
import { deskScore } from "@/lib/feed";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KingBanner({ launch }: { launch: FeedLaunch }) {
  const up = launch.changePct >= 0;
  return (
    <Link href={`/story/${launch.slug}`} className="pad-panel block overflow-hidden rounded-[1.4rem]">
      <article className="relative min-h-[168px]">
        {launch.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={launch.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gold/20 to-heat/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-[#07080c]/55 to-transparent" />
        <div className="relative flex h-full min-h-[168px] flex-col justify-end p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">King of the pad</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">${launch.ticker}</p>
          <p className="truncate text-sm text-white/60">{launch.title}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-white/50">
            <span className={cn("font-semibold tabular-nums", up ? "text-buy" : "text-sell")}>
              {formatPct(launch.changePct)}
            </span>
            <span>{formatUsd(launch.volumeDayUsd || launch.volumeUi)} 24h</span>
            <span className="hidden sm:inline">score {deskScore(launch).toFixed(1)}</span>
          </p>
        </div>
      </article>
    </Link>
  );
}
