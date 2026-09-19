import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("block space-y-1.5", className)}>
      <Label className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-white/40">{hint}</p> : null}
    </div>
  );
}

export function ToggleRow({
  label,
  body,
  checked,
  onCheckedChange,
}: {
  label: string;
  body: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors",
        checked ? "border-gold/35 bg-gold/8" : "border-white/10 bg-black/20 hover:border-white/20",
      )}
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-white/45">{body}</span>
      </span>
      <span
        className={cn(
          "mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-gold/50 bg-gold" : "border-white/15 bg-white/10",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "size-5 rounded-full bg-ink transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
