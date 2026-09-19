import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/pad/sparkline";
import { CurveMeter } from "@/components/pad/curve-meter";
import { WatchButton } from "@/components/pad/watch-button";
import { tickerHue, launchChainLabel, launchHref, type FeedLaunch } from "@/lib/feed";
import { formatPct, formatUsd, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

function Avatar({ launch }: { launch: FeedLaunch }) {
  const hue = tickerHue(launch.ticker);
  return (
    <div
      className="relative size-11 shrink-0 overflow-hidden rounded-2xl border border-white/10 lg:size-9 lg:rounded-xl"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 42%), hsl(${(hue + 40) % 360} 60% 18%))` }}
    >
      {launch.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={launch.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center font-heading text-xs font-bold">
          {launch.ticker.slice(0, 3)}
        </span>
      )}
    </div>
  );
}

export function TokenRow({ launch }: { launch: FeedLaunch }) {
  const up = launch.changePct >= 0;
  const hot = (launch.volumeDayUsd || launch.volumeUi) >= 100 || launch.changePct >= 20;
  const dest = launchHref(launch);
  const chain = launchChainLabel(launch.chain);
  const offPlatform = launch.chain !== "arc";
  return (
    <div className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-white/[0.04] lg:gap-3 lg:px-3 lg:py-2">
      <Link href={dest.href} className="flex min-w-0 flex-1 items-center gap-2.5">
        <Avatar launch={launch} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-base font-semibold tracking-tight lg:text-sm">${launch.ticker}</p>
            {launch.chain && launch.chain !== "arc" ? (
              <span className="text-[10px] uppercase text-white/40">{chain}</span>
            ) : null}
            {hot ? <Badge>Hot</Badge> : null}
            {launch.lastSide ? (
              <span className={launch.lastSide === "buy" ? "text-[10px] uppercase text-buy" : "text-[10px] uppercase text-sell"}>
                {launch.lastSide}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-parchment/45">
            {launch.title}
            {launch.handle ? ` · @${launch.handle}` : ""}
            {" · "}
            {timeAgo(launch.createdAt)}
          </p>
        </div>
      </Link>
      <Sparkline points={launch.spark} up={up} className="hidden shrink-0 sm:block" />
      <Link href={dest.href} className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums lg:font-medium">{formatUsd(launch.priceUi, 4)}</p>
        <p className={cn("text-[11px] tabular-nums", up ? "text-buy" : "text-sell")}>{formatPct(launch.changePct)}</p>
      </Link>
      <p className="hidden w-20 shrink-0 text-right text-sm tabular-nums text-parchment/80 sm:block">
        {formatUsd(launch.volumeDayUsd || launch.volumeUi)}
      </p>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="hidden sm:inline">
          <WatchButton slug={launch.slug} />
        </span>
        <Link
          href={offPlatform ? dest.href : `/story/${launch.slug}?buy=1`}
          className="rounded-full bg-gold px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink"
        >
          {offPlatform ? "View" : "Buy"}
        </Link>
      </div>
    </div>
  );
}

export function LaunchCard({ launch }: { launch: FeedLaunch }) {
  const hue = tickerHue(launch.ticker);
  const up = launch.changePct >= 0;
  return (
    <Link href={`/story/${launch.slug}`} className="group block h-full">
      <article className="pad-panel flex h-full flex-col overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-0.5 hover:border-gold/40">
        <div
          className="relative h-24 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 48% 16%), hsl(${(hue + 48) % 360} 55% 28%), hsl(${(hue + 170) % 360} 32% 12%))`,
          }}
        >
          {launch.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={launch.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" />
          <div className="absolute inset-x-4 bottom-3 flex items-end justify-between">
            <p className="font-heading text-2xl font-bold tracking-tight text-white">${launch.ticker}</p>
            <span className={cn("text-sm font-semibold tabular-nums", up ? "text-buy" : "text-sell")}>
              {formatPct(launch.changePct)}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-heading text-lg font-semibold leading-tight group-hover:text-arc">{launch.title}</h3>
          <div className="flex items-center justify-between">
            <Sparkline points={launch.spark} up={up} />
            <p className="text-sm tabular-nums text-parchment/80">{formatUsd(launch.priceUi, 4)}</p>
          </div>
          <CurveMeter progressBps={launch.progressBps} graduated={launch.status === "graduated"} />
          <div className="mt-auto flex flex-wrap gap-1.5 text-[11px] text-parchment/55">
            <span>{formatUsd(launch.volumeDayUsd || launch.volumeUi)} 24h</span>
            <span>· {launch.holders} holders</span>
            <span>· {launch.pairLabel}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function EmptyPad({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={cn("pad-panel rounded-2xl border-dashed px-6 py-14 text-center", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-arc">The pad is open</p>
      <h3 className="font-heading mt-3 text-2xl font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-parchment/65">{body}</p>
    </div>
  );
}
