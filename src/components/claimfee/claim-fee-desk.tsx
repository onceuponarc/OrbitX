"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { postClaimCreatorFees } from "@/lib/http/claim-creator-fees";
import { XMark } from "@/components/x-mark";

export function ClaimFeeDesk({ signedIn = false }: { signedIn?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  async function claim() {
    if (!signedIn) {
      setError("Sign in with X first. Claims use your in-app Solana desk.");
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = await postClaimCreatorFees();
      setMessage(body.explorer);
    } catch (cause) {
      const text =
        cause instanceof DOMException && cause.name === "TimeoutError"
          ? "Claim timed out. Fund the desk and retry."
          : cause instanceof Error
            ? cause.message
            : "Could not claim creator fees.";
      setError(text);
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">Solana · Pump.fun</p>
        <h2 className="mt-2 text-xl font-semibold">Creator fee sweep</h2>
      </div>
      <div className="mt-6 space-y-3 text-sm text-white/60">
        <p>
          Claims pay into your in-app Solana desk — the same wallet that launched the coin. No Phantom, no extra
          connect step.
        </p>
      </div>
      {signedIn ? (
        <Button type="button" className="mt-6" onClick={() => void claim()} disabled={busy}>
          {busy ? "Claiming…" : "Claim all creator fees"}
        </Button>
      ) : (
        <Button type="button" className="mt-6" asChild>
          <a href="/auth/login" className="gap-1.5">
            <XMark className="size-3.5" />
            Sign in with X to claim
          </a>
        </Button>
      )}
      {message ? <p className="mt-4 break-all text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-4 break-words text-xs text-red-300">{error}</p> : null}
      <p className="mt-6 text-[11px] leading-5 text-white/35">
        Network fees are paid by your in-app Solana desk. Fund it from Wallet before claiming.
      </p>
    </section>
  );
}
