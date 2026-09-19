"use client";

import { Button } from "@/components/ui/button";
import { adjacentStep } from "@/lib/custom-launch/schema";
import { useCustomLaunch, useStepStatus } from "@/components/custom-launch/draft-provider";

export function StepFooter() {
  const { step, goAdjacent } = useCustomLaunch();
  const prev = adjacentStep(step, -1);
  const next = adjacentStep(step, 1);
  const status = useStepStatus(step);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button type="button" variant="outline" disabled={!prev} onClick={() => goAdjacent(-1)}>
        Back
      </Button>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
        {status === "complete" || status === "ready" ? "This step is set" : "This step still needs input"}
      </p>
      <Button type="button" disabled={!next} onClick={() => goAdjacent(1)}>
        Continue
      </Button>
    </div>
  );
}
