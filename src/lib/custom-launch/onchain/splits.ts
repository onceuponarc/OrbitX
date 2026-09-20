import { DEST_INDEX } from "./abi.ts";
import { resolvedFeeAllocations } from "../fees.ts";
import type { CustomLaunchDraft } from "../schema.ts";

export type SplitBps = [number, number, number, number, number, number, number, number, number];

export function splitArray(draft: CustomLaunchDraft): SplitBps {
  const rows = resolvedFeeAllocations(draft.mode, draft.fees);
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0] as SplitBps;
  for (const row of rows) {
    const key = row.id === "custom" ? "community" : row.id;
    const idx = DEST_INDEX[key as keyof typeof DEST_INDEX];
    if (idx !== undefined) out[idx] += row.bps;
  }
  return out;
}
