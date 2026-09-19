import { FeedBoard } from "@/components/pad/feed-board";
import { LiveRefresh } from "@/components/pad/live-refresh";
import { OrbitHero } from "@/components/pad/orbit-hero";
import { KingBanner } from "@/components/pad/king-banner";
import { loadPadMarket } from "@/lib/market";
import { getSessionUser } from "@/lib/auth";
import { tokenOfTheDay } from "@/lib/feed";
import Link from "next/link";
import { viewAllCards } from "@/lib/cards/resolve";
import { CardRail } from "@/components/cards/card-rail";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { profile } = await getSessionUser();
  const { launches } = await loadPadMarket();
  const liveCount = launches.filter((item) => item.status === "live").length;
  const bondedCount = launches.filter((item) => item.status === "graduated").length;
  const volume = launches.reduce((sum, item) => sum + item.volumeUi, 0);
  const totd = tokenOfTheDay(launches);
  const cards = await viewAllCards().catch(() => []);

  return (
    <div className="space-y-5 lg:space-y-8">
      <LiveRefresh intervalMs={2000} />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="space-y-5 lg:space-y-6">
          <OrbitHero
            liveCount={liveCount}
            bondedCount={bondedCount}
            volumeUi={volume}
            handle={profile?.handle ?? null}
          />
          <div className="grid grid-cols-3 gap-2 lg:hidden">
            <HomeLink href="/cards" label="Cards" />
            <HomeLink href="/drop" label="Drop" />
            <HomeLink href="/params" label="$ORBITX" />
          </div>
          <FeedBoard launches={launches} king={totd} />
        </div>
        <aside className="mt-5 space-y-4 lg:sticky lg:top-24 lg:mt-0">
          {totd ? <KingBanner launch={totd} /> : null}
          {cards.length ? <CardRail cards={cards.slice(0, 8)} /> : null}
          <Link
            href="/whitepaper"
            className="pad-panel hidden rounded-2xl px-5 py-4 text-sm text-white/55 transition-colors hover:text-white lg:block"
          >
            How launches, Press Cards, and $ORBITX work →
          </Link>
        </aside>
      </div>
    </div>
  );
}

function HomeLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="pad-panel rounded-2xl px-2 py-3 text-center text-xs font-semibold text-white/80">
      {label}
    </Link>
  );
}
