"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FEED_TABS, filterFeed, isListedLaunch, launchHref, type FeedLaunch, type FeedTab } from "@/lib/feed";
import { EmptyPad, TokenRow } from "@/components/pad/launch-card";
import { readWatch } from "@/components/pad/watch-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const EMPTY: Record<FeedTab, { title: string; body: string }> = {
  new: {
    title: "No launches yet",
    body: "Be first. Launch a token — it is tradable the moment create lands.",
  },
  trending: {
    title: "Nothing trending yet",
    body: "Volume ranks as soon as the first buy hits a curve.",
  },
  curve: {
    title: "Nobody is graduating",
    body: "Live tokens bond until their target, then they graduate.",
  },
  bonded: {
    title: "Nothing graduated yet",
    body: "Graduated is the pool tape.",
  },
};

export function FeedBoard({ launches, king }: { launches: FeedLaunch[]; king?: FeedLaunch | null }) {
  const [tab, setTab] = useState<FeedTab>("trending");
  const [watchOnly, setWatchOnly] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    function sync() {
      setWatch(readWatch());
    }
    sync();
    window.addEventListener("onceupon-watch", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("onceupon-watch", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const listed = useMemo(() => launches.filter(isListedLaunch), [launches]);
  const shown = useMemo(() => {
    const rows = watchOnly ? listed.filter((row) => watch.includes(row.slug)) : filterFeed(listed, tab);
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (item) =>
        item.ticker.toLowerCase().includes(needle) ||
        item.title.toLowerCase().includes(needle) ||
        (item.handle ?? "").toLowerCase().includes(needle),
    );
  }, [listed, tab, q, watchOnly, watch]);
  const empty = EMPTY[tab];

  return (
    <section className="space-y-3 pad-fade">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Board</p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight lg:text-3xl">Live tokens</h2>
        </div>
        {king ? (
          <Link
            href={launchHref(king).href}
            className="pad-chip hidden rounded-full px-3 py-1.5 text-sm lg:inline-flex"
          >
            <span className="font-medium">${king.ticker}</span>
            <span className="ml-2 opacity-70">{formatPct(king.changePct)}</span>
          </Link>
        ) : null}
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search ticker or name"
        className="h-11 rounded-2xl border-white/10 bg-white/5 lg:h-9 lg:max-w-sm"
      />
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-black/20 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FEED_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setWatchOnly(false);
              setTab(item.id);
            }}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2 text-sm transition-colors lg:py-1.5",
              !watchOnly && tab === item.id ? "bg-gold text-ink font-semibold" : "text-white/55 hover:text-white",
            )}
          >
            {item.label}
            <span className="ml-1 text-xs opacity-60">{filterFeed(listed, item.id).length}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setWatchOnly(true)}
          className={cn(
            "shrink-0 rounded-xl px-3 py-2 text-sm transition-colors lg:py-1.5",
            watchOnly ? "bg-gold text-ink font-semibold" : "text-white/55 hover:text-white",
          )}
        >
          Watch {watch.length}
        </button>
      </div>
      <div className="pad-panel overflow-hidden rounded-[1.35rem]">
        <div className="hidden px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/30 lg:grid lg:grid-cols-[minmax(0,1.4fr)_90px_minmax(72px,0.7fr)_minmax(64px,0.55fr)_88px]">
          <span>Token</span>
          <span>Chart</span>
          <span className="text-right">Price</span>
          <span className="text-right">Volume</span>
          <span className="text-right">Trade</span>
        </div>
        {shown.length === 0 ? (
          <div className="space-y-4 p-4">
            <EmptyPad
              title={watchOnly ? "Nothing watched" : empty.title}
              body={watchOnly ? "Tap Watch on a row. It stays on this device." : empty.body}
            />
            <div className="flex justify-center pb-2">
              <Button asChild>
                <Link href="/launch">Launch a token</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {shown.map((launch) => (
              <TokenRow key={launch.slug} launch={launch} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
