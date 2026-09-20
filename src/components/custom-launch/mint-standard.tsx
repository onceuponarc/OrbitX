"use client";

import { Field } from "@/components/custom-launch/field";
import { isMintStandard, type MintStandard } from "@/lib/custom-launch/token";
import { cn } from "@/lib/utils";

const OPTIONS: { id: MintStandard; title: string; body: string }[] = [
  {
    id: "spl",
    title: "SPL Token",
    body: "Classic Token Program mint. Curve fees are taken in quote. Links to the same real SOL/USDC books.",
  },
  {
    id: "token2022",
    title: "Token-2022",
    body: "Token-2022 mint with an optional transfer fee. Same bonding curve and linked DEX books at launch.",
  },
];

export function MintStandard({
  value,
  onChange,
}: {
  value: MintStandard;
  onChange: (next: MintStandard) => void;
}) {
  const current = isMintStandard(value) ? value : "token2022";
  return (
    <Field label="Mint standard" hint="Solana only. Arc/RH print ERC-20.">
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((row) => {
          const active = current === row.id;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onChange(row.id)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-all",
                active
                  ? "border-gold/50 bg-gold/10"
                  : "border-white/10 bg-black/20 text-white/70 hover:border-white/25 hover:text-white",
              )}
            >
              <p className="text-sm font-semibold text-white">{row.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{row.body}</p>
            </button>
          );
        })}
      </div>
    </Field>
  );
}
