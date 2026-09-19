import { readApiJson } from "@/lib/http/read-json";

const CLAIM_MS = 28_000;

export type ClaimCreatorFeesResult = {
  signature: string;
  explorer: string;
};

/** POST the desk claim route with a hard client timeout so the button cannot lock the tab. */
export async function postClaimCreatorFees(): Promise<ClaimCreatorFeesResult> {
  const res = await fetch("/api/solana/claim", {
    method: "POST",
    signal: AbortSignal.timeout(CLAIM_MS),
  });
  const body = await readApiJson<{ error?: string; signature?: string; explorer?: string }>(res);
  if (!res.ok || !body.signature) {
    throw new Error(body.error ?? "Could not claim creator fees.");
  }
  return {
    signature: body.signature,
    explorer: body.explorer ?? `https://explorer.solana.com/tx/${body.signature}`,
  };
}
