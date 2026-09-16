"use client";

import { cn } from "@/lib/utils";

export const LAUNCH_KINDS = [
  {
    id: "chapter",
    label: "Chapter",
    title: "Token on the curve",
    body: "Classic OrbitX launch. USDC bonding curve, tradable at create, graduate at target.",
  },
  {
    id: "tweet",
    label: "Tweet",
    title: "Spawn from X",
    body: "Paste a post. Print a 3D jacket from the tweet. Pair a Chapter if you want MC tracking.",
  },
  {
    id: "card",
    label: "Card",
    title: "Jacket only",
    body: "Collectible press card. No coin required. Buyer pays your USDC wallet.",
  },
  {
    id: "pair",
    label: "Pair",
    title: "Token + card",
    body: "Launch both. Coin trades on the curve. Card value tracks that MC. Separate books.",
  },
] as const;

export type LaunchKind = (typeof LAUNCH_KINDS)[number]["id"];

export function LaunchKindPicker({
  value,
  onChange,
}: {
  value: LaunchKind;
  onChange: (next: LaunchKind) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {LAUNCH_KINDS.map((kind) => (
        <button
          key={kind.id}
          type="button"
          onClick={() => onChange(kind.id)}
          className={cn(
            "rounded-2xl border px-4 py-4 text-left",
            value === kind.id ? "border-white bg-white/10" : "border-white/10 text-white/70 hover:border-white/30",
          )}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">{kind.label}</p>
          <p className="mt-1 font-semibold">{kind.title}</p>
          <p className="mt-1 text-xs leading-5 text-white/50">{kind.body}</p>
        </button>
      ))}
    </div>
  );
}
