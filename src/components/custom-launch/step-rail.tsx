"use client";

import { CUSTOM_LAUNCH_STEPS, stepIndex } from "@/lib/custom-launch/schema";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/custom-launch/status-chip";
import { useCustomLaunch, useStepStatus } from "@/components/custom-launch/draft-provider";

export function StepRail() {
  const { step, setStep } = useCustomLaunch();
  const current = stepIndex(step);

  return (
    <>
      <nav
        aria-label="Custom Launch steps"
        className="ox-console hidden w-[240px] shrink-0 rounded-[1.4rem] p-3 lg:block"
      >
        <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
          Control stack
        </p>
        <ol className="space-y-1">
          {CUSTOM_LAUNCH_STEPS.map((item, index) => (
            <StepButton
              key={item.id}
              index={index}
              currentIndex={current}
              active={item.id === step}
              id={item.id}
              label={item.label}
              onSelect={() => setStep(item.id)}
              layout="rail"
            />
          ))}
        </ol>
      </nav>
      <nav
        aria-label="Custom Launch steps"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
      >
        {CUSTOM_LAUNCH_STEPS.map((item, index) => (
          <StepButton
            key={item.id}
            index={index}
            currentIndex={current}
            active={item.id === step}
            id={item.id}
            label={item.short}
            onSelect={() => setStep(item.id)}
            layout="chip"
          />
        ))}
      </nav>
    </>
  );
}

function StepButton({
  id,
  label,
  index,
  currentIndex,
  active,
  onSelect,
  layout,
}: {
  id: (typeof CUSTOM_LAUNCH_STEPS)[number]["id"];
  label: string;
  index: number;
  currentIndex: number;
  active: boolean;
  onSelect: () => void;
  layout: "rail" | "chip";
}) {
  const status = useStepStatus(id);
  const reached = index <= currentIndex || status === "complete" || status === "ready";

  if (layout === "chip") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
          active ? "border-gold bg-gold text-ink" : "border-white/12 text-white/60",
        )}
      >
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors",
          active ? "bg-gold/12" : "hover:bg-white/5",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px]",
            active
              ? "bg-gold text-ink"
              : reached
                ? "border border-gold/35 text-gold"
                : "border border-white/12 text-white/35",
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-medium", active ? "text-white" : "text-white/70")}>
            {label}
          </span>
        </span>
        <StatusChip status={status} />
      </button>
    </li>
  );
}
