import { WalletDesk } from "@/components/wallet/desk";
import { HoldingsPanel } from "@/components/wallet/holdings";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Wallet" };

export default function WalletPage() {
  return (
    <div className="space-y-5 pad-fade">
      <section className="pad-panel rounded-[1.4rem] p-5 lg:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold/80">Wallet</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">Your desk</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55 lg:text-base">
          Addresses and live balances. Fund a chain, launch, collect fees. Keys stay on the export page.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
          <Button asChild className="h-11 rounded-2xl lg:h-8 lg:rounded-lg">
            <Link href="/launch">Launch</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-2xl lg:h-8 lg:rounded-lg">
            <Link href="/wallet/keys">Export keys</Link>
          </Button>
        </div>
      </section>
      <HoldingsPanel />
      <WalletDesk />
    </div>
  );
}
