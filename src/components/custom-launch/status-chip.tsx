import { cn } from "@/lib/utils";
import type { StepStatus } from "@/lib/custom-launch/schema";

const LABELS: Record<StepStatus, string> = {
  complete: "Configured",
  incomplete: "Incomplete",
  ready: "Ready",
  blocked: "Blocked",
};

export function StatusChip({
  status,
  className,
}: {
  status: StepStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        status === "complete" && "bg-buy/12 text-buy",
        status === "ready" && "bg-gold/15 text-gold",
        status === "incomplete" && "bg-white/8 text-white/50",
        status === "blocked" && "bg-heat/12 text-heat",
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
