"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";

type Card = {
  id: string;
  kicker: string;
  title: string;
  handle: string;
  body: string;
  href: string | null;
  cta: string;
  accent: string;
};

const CARDS: Card[] = [
  {
    id: "x",
    kicker: "01 — Press",
    title: "X",
    handle: "@orbitx_wrld",
    body: "Launches, tape, and the Chapter desk. Follow the press.",
    href: "https://x.com/orbitx_wrld",
    cta: "Open X",
    accent: "#ffffff",
  },
  {
    id: "updates",
    kicker: "02 — Wire",
    title: "Updates",
    handle: "t.me/onceuponupdates",
    body: "The update room. Prints, deploys, and desk notes only.",
    href: "https://t.me/onceuponupdates",
    cta: "Join updates",
    accent: "#2AABEE",
  },
  {
    id: "tg",
    kicker: "03 — Floor",
    title: "Community",
    handle: "t.me/onceuponarc",
    body: "Telegram floor. Chapters, fills, and the people writing them.",
    href: "https://t.me/onceuponarc",
    cta: "Enter Telegram",
    accent: "#2AABEE",
  },
  {
    id: "web",
    kicker: "04 — Site",
    title: "Website",
    handle: "orbitxtrade.world",
    body: "Official launchpad. $ORBITX is live on Solana.",
    href: `${PUBLIC_SITE_URL}/`,
    cta: "Open site",
    accent: "#a3a3a3",
  },
  {
    id: "token",
    kicker: "05 — Official token",
    title: "Token",
    handle: "$ORBITX live",
    body: "$ORBITX is live on Solana. CA 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9. Ignore anywhere else.",
    href: "/params",
    cta: "Read /params",
    accent: "#e8c36a",
  },
];

export function ShareDeck() {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

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
      node.querySelectorAll<HTMLElement>("[data-card]").forEach((card, i) => {
        const delta = i - progress;
        const tilt = Math.max(-1, Math.min(1, delta));
        card.style.transform = `translate3d(0, ${Math.abs(tilt) * 18}px, ${-Math.abs(tilt) * 120}px) rotateY(${tilt * -28}deg) rotateX(${Math.abs(tilt) * 4}deg)`;
        card.style.filter = `brightness(${1 - Math.abs(tilt) * 0.28})`;
        card.style.opacity = String(1 - Math.min(0.55, Math.abs(tilt) * 0.35));
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
  }, []);

  function go(next: number) {
    const node = scroller.current;
    if (!node) return;
    const clamped = Math.max(0, Math.min(CARDS.length - 1, next));
    node.scrollTo({ left: clamped * node.clientWidth, behavior: "smooth" });
  }

  async function sharePage() {
    const url = typeof window !== "undefined" ? `${window.location.origin}/links` : "/links";
    try {
      if (navigator.share) {
        await navigator.share({ title: "OrbitX on Arc", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="links-stage relative w-screen max-w-none -mx-4 min-h-[calc(100dvh-8rem)] overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="links-orb links-orb-a" />
        <div className="links-orb links-orb-b" />
        <div className="links-grid" />
      </div>

      <div className="relative z-10 flex items-end justify-between gap-4 px-5 pt-2 sm:px-10">
        <div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.jpg" alt="" className="size-12 rounded-xl border border-white/15 object-cover" />
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/40">OrbitX · Arc</p>
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-6xl">The desk.</h1>
          <p className="mt-2 max-w-md text-sm text-white/55">
            Drag sideways. Every card is a door. Website still on the press.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sharePage()}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/80 hover:bg-white hover:text-black"
        >
          {copied ? "Copied" : "Share /links"}
        </button>
      </div>

      <div
        ref={scroller}
        className="links-scroller relative z-10 mt-8 flex h-[min(72dvh,640px)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CARDS.map((card, i) => (
          <section
            key={card.id}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center px-4 sm:px-10"
          >
            <article
              data-card
              className="links-card group relative h-[min(56dvh,520px)] w-full max-w-md origin-center rounded-[2rem] border border-white/15 shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
            >
              <div
                className="links-card-face relative h-full overflow-hidden rounded-[2rem] p-7"
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
                <div className="links-sheen pointer-events-none absolute inset-0 rounded-[2rem]" />
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">{card.kicker}</p>
                <h2 className="mt-8 text-6xl font-semibold tracking-tight" style={{ color: card.accent }}>
                  {card.title}
                </h2>
                <p className="mt-3 font-mono text-sm text-white/70">{card.handle}</p>
                <p className="mt-6 max-w-sm text-base leading-relaxed text-white/60">{card.body}</p>
                <div className="absolute bottom-7 left-7 right-7">
                  {card.href ? (
                    <a
                      href={card.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:scale-[1.02]"
                    >
                      {card.cta}
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em]">↗</span>
                    </a>
                  ) : (
                    <div className="flex items-center justify-between rounded-full border border-white/20 px-5 py-3 text-sm text-white/50">
                      {card.cta}
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em]">soon</span>
                    </div>
                  )}
                </div>
              </div>
            </article>
            <span className="sr-only">{i + 1}</span>
          </section>
        ))}
      </div>

      <div className="relative z-10 mt-6 flex items-center justify-center gap-3 px-5 pb-8">
        <button
          type="button"
          onClick={() => go(index - 1)}
          className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          Prev
        </button>
        <div className="flex gap-2">
          {CARDS.map((card, i) => (
            <button
              key={card.id}
              type="button"
              aria-label={card.title}
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

      <div className="relative z-10 flex justify-center pb-6">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/35 hover:text-white">
          Back to the pad
        </Link>
      </div>
    </div>
  );
}
