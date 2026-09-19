"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { PrintableChain } from "@onceupon/config/solana";
import { PRINTABLE_CHAIN_IDS } from "@onceupon/config/solana";
import { CUSTOM_CHAIN_META, CUSTOM_LAUNCH_STEPS, stepIndex } from "@/lib/custom-launch/schema";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/custom-launch/status-chip";
import { useCustomLaunch, useStepStatus } from "@/components/custom-launch/draft-provider";

export function CustomLaunchShell({ children }: { children: ReactNode }) {
  const { chain, meta, step, configured, total, reset, ready } = useCustomLaunch();
  const status = useStepStatus(step);
  const current = CUSTOM_LAUNCH_STEPS[stepIndex(step)];

  return (
    <div className="space-y-4 lg:space-y-5">
      <section className="ox-console relative overflow-hidden rounded-[1.5rem] px-5 py-5 sm:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgb(214_255_61/12%),transparent_55%)]" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">
                Custom Launch · {meta.longLabel}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">
                Configure the print
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">
                Advanced desk for token economics, markets, liquidity, and automation. Local preview
                only — nothing is broadcast from this screen.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 hover:text-white"
            >
              Reset draft
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRINTABLE_CHAIN_IDS.map((id) => (
              <LaneLink
                key={id}
                href={`/launch/${id}/custom`}
                active={id === chain}
                label={CUSTOM_CHAIN_META[id].label}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <LaneLink href={`/launch/${chain}`} active={false} label="Normal Launch" />
            <LaneLink href={`/launch/${chain}/custom`} active label="Custom Launch" />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <ContextStat label="Venue" value={`${meta.longLabel} · ${meta.venue}`} />
            <ContextStat
              label="Step"
              value={`${String(stepIndex(step) + 1).padStart(2, "0")} ${current.label}`}
              extra={<StatusChip status={status} />}
            />
            <ContextStat
              label="Draft"
              value={`${configured} / ${total} set`}
              extra={<StatusChip status={ready ? "ready" : "incomplete"} />}
            />
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

function LaneLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
        active ? "border-white bg-white text-black" : "border-white/15 text-white/60 hover:text-white",
      )}
    >
      {label}
    </Link>
  );
}

function ContextStat({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: ReactNode;
}) {
  return (
    <div className="ox-console-metal rounded-2xl border border-white/8 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
        {extra}
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

export function customLaunchPath(chain: PrintableChain) {
  return `/launch/${chain}/custom`;
}
