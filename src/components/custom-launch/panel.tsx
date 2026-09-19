import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ControlPanel({
  eyebrow,
  title,
  body,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("ox-console rounded-[1.4rem] p-5 lg:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          {eyebrow ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
          {body ? <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "live" | "warn";
}) {
  return (
    <div className="ox-console-metal rounded-2xl border border-white/8 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tracking-tight tabular-nums",
          tone === "live" && "text-gold",
          tone === "warn" && "text-heat",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}
