"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { postClaimCreatorFees } from "@/lib/http/claim-creator-fees";

export function ClaimFeesButton({ signedIn }: { signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ explorer: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  async function claim() {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = await postClaimCreatorFees();
      setResult({ explorer: body.explorer });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "TimeoutError"
          ? "Claim timed out. Fund the desk and retry."
          : err instanceof Error
            ? err.message
            : "Claim failed.";
      setError(message);
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  if (!signedIn) return null;

  return (
    <div className="space-y-1.5">
      <Button type="button" size="sm" variant="outline" onClick={() => void claim()} disabled={busy}>
        {busy ? "Claiming…" : "Claim my pump.fun creator fees"}
      </Button>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {result ? (
        <p className="text-xs text-emerald-400">
          Claimed —{" "}
          <a href={result.explorer} target="_blank" rel="noreferrer" className="underline">
            view tx
          </a>
        </p>
      ) : null}
    </div>
  );
}
