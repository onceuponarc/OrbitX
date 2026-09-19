import type { Metadata } from "next";
import Link from "next/link";
import { viewAllCards } from "@/lib/cards/resolve";
import { CardsBoard } from "@/components/cards/cards-board";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Press cards",
  description: "3D tradable jackets with art. Price tracks paired Chapter MC. Coin and card stay separate.",
};

export default async function CardsPage() {
  const cards = await viewAllCards().catch(() => []);
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">Press</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">Tradable cards</h1>
          <p className="mt-2 max-w-2xl text-white/55">
            Press cards are offline on the public pad while we ship live tokens. $ORBITX is on the board.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" asChild className="h-11 rounded-2xl sm:h-8 sm:rounded-lg">
            <Link href="/launch">Launch</Link>
          </Button>
          <Button asChild className="h-11 rounded-2xl sm:h-8 sm:rounded-lg">
            <Link href="/trade">Trade $ORBITX</Link>
          </Button>
        </div>
      </section>
      {cards.length ? <CardsBoard cards={cards} /> : (
        <p className="pad-panel rounded-2xl px-5 py-10 text-center text-sm text-white/50">
          No public cards listed.
        </p>
      )}
    </div>
  );
}
