import type { Metadata } from "next";
import { ClaimFeeDesk } from "@/components/claimfee/claim-fee-desk";

export const metadata: Metadata = {
  title: "Pump.fun creator fees",
  description: "Connect a Solana wallet and claim Pump.fun creator fees.",
};

export default function ClaimFeePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-8">
      <section className="rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Standalone tool</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Claim Pump.fun creator fees</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
          Connect the wallet that created your Pump.fun coins. OrbitX builds the official creator-fee claim
          transaction; your wallet reviews, signs, and submits it.
        </p>
      </section>
      <ClaimFeeDesk />
    </div>
  );
}
