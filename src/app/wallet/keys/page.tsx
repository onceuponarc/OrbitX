import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WalletKeysDesk } from "@/components/wallet/desk";
import { ArcWalletDesk } from "@/components/arc/arc-wallet-desk";

export const metadata = { title: "Export keys" };

export default function WalletKeysPage() {
  return (
    <div className="space-y-6 pad-fade">
      <section className="rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-200/70">Export keys</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Private key and recovery phrase</h1>
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
