"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FeedLaunch } from "@/lib/feed";
import { tickerHue } from "@/lib/feed";
import { formatUsd } from "@/lib/format";

export function TokenDeck({ launches }: { launches: FeedLaunch[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const cards = launches.slice(0, 12);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    function paint() {
      const node = scroller.current;
      if (!node) return;
      const width = node.clientWidth || 1;
      const progress = node.scrollLeft / width;
      setIndex(Math.round(progress));
      node.querySelectorAll<HTMLElement>("[data-token-card]").forEach((card, i) => {
        const delta = i - progress;
        const tilt = Math.max(-1, Math.min(1, delta));
        card.style.transform = `translate3d(0, ${Math.abs(tilt) * 8}px, 0) rotateY(${tilt * -12}deg)`;
        card.style.filter = `brightness(${1 - Math.abs(tilt) * 0.28})`;
        card.style.opacity = String(1 - Math.min(0.5, Math.abs(tilt) * 0.32));
      });
    }
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    }
    paint();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", paint);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", paint);
    };
  }, [cards.length]);

  function go(next: number) {
    const node = scroller.current;
    if (!node) return;
    const clamped = Math.max(0, Math.min(cards.length - 1, next));
    node.scrollTo({ left: clamped * node.clientWidth, behavior: "smooth" });
  }

  if (!cards.length) return null;

  return (
    <div className="relative isolate z-0 overflow-hidden rounded-3xl border border-white/10">
      <div
        ref={scroller}
        className="flex h-[min(58dvh,520px)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ perspective: "1400px" }}
      >
        {cards.map((launch, i) => (
          <section
            key={launch.slug}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center px-4 py-6 sm:px-8"
            style={{ pointerEvents: i === index ? "auto" : "none" }}
          >
            <TokenGlossCard launch={launch} />
          </section>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 px-4 pb-5">
        <button
          type="button"
          onClick={() => go(index - 1)}
          className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          Prev
        </button>
        <div className="flex gap-2">
          {cards.map((launch, i) => (
            <button
              key={launch.slug}
              type="button"
              aria-label={launch.ticker}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-2 bg-white/25"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function TokenGlossCard({ launch }: { launch: FeedLaunch }) {
  const hue = tickerHue(launch.ticker);
  const progress = Math.min(100, Math.max(0, launch.progressBps / 100));

  return (
    <article
      data-token-card
      className="links-card relative h-full w-full max-w-md origin-center rounded-[2rem] border border-white/15 shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
    >
      <Link
        href={`/story/${launch.slug}`}
        className="links-card-face relative block h-full overflow-hidden rounded-[2rem]"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          event.currentTarget.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
          event.currentTarget.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.setProperty("--rx", "0deg");
          event.currentTarget.style.setProperty("--ry", "0deg");
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, hsl(${hue} 45% 14%), #050505 58%)`,
          }}
        />
        {launch.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={launch.coverUrl} alt="" className="absolute inset-0 h-[58%] w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="links-sheen pointer-events-none absolute inset-0 rounded-[2rem]" />

        <div className="relative flex h-full flex-col justify-end p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">
            {launch.status === "graduated" ? "Graduated" : "On the curve"}
            {launch.handle ? ` · @${launch.handle}` : ""}
          </p>
          <h3 className="mt-2 text-5xl font-semibold tracking-tight">${launch.ticker}</h3>
          <p className="mt-1 truncate text-sm text-white/55">{launch.title}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="24h" value={formatUsd(launch.volumeDayUsd || launch.volumeUi)} />
            <Stat label="7d" value={formatUsd(launch.volumeWeekUsd || launch.volumeUi)} />
            <Stat label="Total" value={formatUsd(launch.volumeTotalUsd || launch.volumeUi)} />
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-white" style={{ width: `${launch.status === "graduated" ? 100 : progress}%` }} />
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
            {launch.status === "graduated" ? "Pool open" : `${progress.toFixed(0)}% to graduate`}
          </p>
          <div className="mt-5 flex items-center justify-between rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
            Trade Chapter
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">↗</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-2 py-2">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</p>
    </div>
  );
}
