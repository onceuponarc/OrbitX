"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { CustomLaunchStepId } from "@/lib/custom-launch/schema";

export function SectionSummary({
  eyebrow,
  title,
  onEdit,
  step,
  children,
}: {
  eyebrow: string;
  title: string;
  onEdit: (id: CustomLaunchStepId) => void;
  step: CustomLaunchStepId;
  children: ReactNode;
}) {
  return (
    <section className="ox-console rounded-[1.35rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{title}</h3>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onEdit(step)}>
          Edit
        </Button>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SummaryGrid({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">{row.label}</dt>
          <dd className="mt-1 text-sm text-white/80">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
