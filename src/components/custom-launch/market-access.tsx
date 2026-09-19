"use client";

import { ToggleRow } from "@/components/custom-launch/field";
import type { MarketAccess as MarketAccessState } from "@/lib/custom-launch/markets";

export function MarketAccess({
  value,
  onChange,
}: {
  value: MarketAccessState;
  onChange: (next: Partial<MarketAccessState>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Market access</p>
        <p className="mt-1 text-sm text-white/50">
          Future-facing flags. These do not grant permissions or open a venue.
        </p>
      </div>
      <ToggleRow
        label="Primary market enabled"
        body="The required first book for this Custom Launch."
        checked={value.primaryEnabled}
        onCheckedChange={(primaryEnabled) => onChange({ primaryEnabled })}
      />
      <ToggleRow
        label="Secondary markets enabled"
        body="Allow additional books after the primary market."
        checked={value.secondaryEnabled}
        onCheckedChange={(secondaryEnabled) => onChange({ secondaryEnabled })}
      />
      <ToggleRow
        label="Additional markets can be connected later"
        body="Keep the draft open to more pairs after the first print."
        checked={value.laterConnections}
        onCheckedChange={(laterConnections) => onChange({ laterConnections })}
      />
    </div>
  );
}
