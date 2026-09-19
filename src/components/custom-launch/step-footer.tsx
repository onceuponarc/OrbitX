"use client";

import { Button } from "@/components/ui/button";
import { adjacentStep } from "@/lib/custom-launch/schema";
import { useCustomLaunch, useStepStatus } from "@/components/custom-launch/draft-provider";

export function StepFooter() {
  const { step, goAdjacent } = useCustomLaunch();
  const prev = adjacentStep(step, -1);
  const next = adjacentStep(step, 1);
  const status = useStepStatus(step);
  const blocked = (step === "token" || step === "economics") && status !== "complete";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button type="button" variant="outline" disabled={!prev} onClick={() => goAdjacent(-1)}>
        Back
      </Button>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
        {step === "deploy"
          ? "Preview only — nothing is broadcast"
          : blocked
            ? "Fix validation before continuing"
            : status === "complete" || status === "ready"
              ? "This step is set"
              : "This step still needs input"}
      </p>
      <Button type="button" disabled={!next || blocked} onClick={() => goAdjacent(1)}>
        Continue
      </Button>
    </div>
  );
}
