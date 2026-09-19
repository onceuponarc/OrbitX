import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WalletKeysDesk } from "@/components/wallet/desk";
import { ArcWalletDesk } from "@/components/arc/arc-wallet-desk";

export const metadata = { title: "Export keys" };

export default function WalletKeysPage() {
  return (
    <div className="space-y-6 pad-fade">
      <section className="pad-panel rounded-[1.4rem] border-heat/25 bg-heat/5 p-5 lg:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-heat">Export keys</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">Private key and recovery phrase</h1>
        <p className="mt-3 max-w-2xl text-white/60">
          This page can reveal secrets. Do not screenshot it. Do not share it. Export both the private key and the
          recovery phrase — some wallets only accept a phrase. Use this only to back up or import a desk wallet.
        </p>
        <div className="mt-5">
          <Button asChild variant="outline">
            <Link href="/wallet">Back to wallet</Link>
          </Button>
        </div>
      </section>
      <WalletKeysDesk />
      <ArcWalletDesk />
    </div>
  );
}
