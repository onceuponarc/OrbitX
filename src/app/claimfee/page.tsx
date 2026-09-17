import type { Metadata } from "next";
import { ClaimFeeDesk } from "@/components/claimfee/claim-fee-desk";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Pump.fun creator fees",
  description: "Claim Pump.fun creator fees into your in-app Solana desk.",
};

export const dynamic = "force-dynamic";

export default async function ClaimFeePage() {
  const { profile } = await getSessionUser();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-8">
      <section className="rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Standalone tool</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Claim Pump.fun creator fees</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
          Claims are signed by your in-app Solana desk — the same wallet that launched the coin. Fund it, then
          sweep creator fees. No Phantom.
        </p>
      </section>
      <ClaimFeeDesk signedIn={Boolean(profile)} />
    </div>
  );
}
