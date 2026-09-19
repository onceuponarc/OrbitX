import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-white/10 p-6 sm:p-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Legal</p>
      <h1 className="text-4xl font-semibold tracking-tight">Terms</h1>
      <p className="text-white/65">
        OrbitX is a software interface for launching and trading tokens on Arc. It is not a broker, exchange, bank, or
        investment adviser. Tokens on this pad are not shares, notes, or claims on any issuer.
      </p>
      <p className="text-white/65">
        Launches sign from an in-app desk wallet OrbitX generates and holds server-side on your behalf — that&apos;s what
        lets you launch and trade without a separate wallet extension. You can export that wallet&apos;s private key
        or recovery phrase from Wallet → Export keys at any time. Once exported, or if you send funds to any address, you own the risk
        of loss, theft, and irreversible transfers.
      </p>
      <p className="text-white/65">
        Curves can go to zero. Graduation is not a listing guarantee. Creator fees are swap fees, not dividends. Holder
        claims are a protocol split of a pool the creator deposits — not profit sharing.
      </p>
      <p className="text-white/65">
        Arc mainnet is chain 5042. You are responsible for every on-chain action.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Back to the pad</Link>
      </Button>
    </article>
  );
}
