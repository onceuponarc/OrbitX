import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  error,
  info,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  info?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("block space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <Label className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">{label}</Label>
        {info ? <InfoTip text={info} /> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-heat">{error}</p> : null}
      {!error && hint ? <p className="text-xs leading-relaxed text-white/40">{hint}</p> : null}
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span className="flex size-4 items-center justify-center rounded-full border border-white/20 font-mono text-[9px] text-white/45">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-56 rounded-xl border border-white/10 bg-ink px-3 py-2 text-xs leading-relaxed text-white/70 shadow-xl group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
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
