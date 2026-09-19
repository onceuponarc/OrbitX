"use client";

import { automationTimeline, type TimelineStatus } from "@/lib/custom-launch/review";
import type { AutomationConfig } from "@/lib/custom-launch/automation";
import { cn } from "@/lib/utils";

export function AutomationTimeline({ automation }: { automation: AutomationConfig }) {
  const nodes = automationTimeline(automation);

  return (
    <section className="ox-console relative overflow-hidden rounded-[1.35rem] p-5">
      <div className="pointer-events-none absolute inset-y-0 left-[22px] w-px bg-gradient-to-b from-gold/0 via-gold/50 to-gold/0 ox-router-pulse" />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Automation timeline</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">Configured milestones</h3>
      <p className="mt-1 text-xs text-white/40">Preview of intended marks. No action fires from this tape.</p>
      <ol className="relative mt-5 space-y-3">
        {nodes.map((node, index) => (
          <li
            key={node.id}
            className={cn(
              "flex items-start gap-3",
              index === 0 ? "pl-1" : "rounded-2xl border border-white/10 bg-black/20 p-3",
            )}
          >
            <span
              className={cn(
                "mt-1.5 size-2.5 shrink-0 rounded-full",
                node.status === "Ready" && "bg-gold",
                node.status === "Pending" && "bg-gold/50",
                node.status === "Disabled" && "bg-white/25",
                node.status === "Requires configuration" && "bg-heat",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{node.title}</p>
                <StatusMark status={node.status} />
              </div>
              {index === 0 ? (
                <p className="mt-1 text-xs text-white/40">
                  {node.trigger} · {node.status} · mock
                </p>
              ) : (
                <dl className="mt-2 grid gap-2 text-xs text-white/55 sm:grid-cols-2">
                  <Meta label="Trigger" value={node.trigger} />
                  <Meta label="Condition" value={node.condition} />
                  <Meta label="Action" value={node.action} />
                  <Meta label="Destination" value={node.destination} />
                  <Meta label="Status" value={node.status} />
                </dl>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono uppercase tracking-[0.14em] text-white/35">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function StatusMark({ status }: { status: TimelineStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        status === "Ready" && "bg-buy/12 text-buy",
        status === "Pending" && "bg-gold/15 text-gold",
        status === "Disabled" && "bg-white/8 text-white/45",
        status === "Requires configuration" && "bg-heat/12 text-heat",
      )}
    >
      {status}
    </span>
  );
}
