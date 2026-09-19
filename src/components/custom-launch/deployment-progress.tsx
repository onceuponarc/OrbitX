"use client";

import { MOCK_DEPLOY_DISCLAIMER, MOCK_DEPLOY_STAGES } from "@/lib/custom-launch/mock-deploy";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { cn } from "@/lib/utils";

export function DeploymentProgress() {
  const { deployStage } = useCustomLaunch();

  return (
    <section className="ox-console relative overflow-hidden rounded-[1.5rem] p-5 lg:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_0%,rgb(214_255_61/12%),transparent_50%)]" />
      <div className="relative">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">Mock deployment</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Initializing Custom Launch</h2>
        <p className="mt-2 max-w-xl text-sm text-white/50">{MOCK_DEPLOY_DISCLAIMER}</p>
        <ol className="mt-6 space-y-2">
          {MOCK_DEPLOY_STAGES.map((stage, index) => {
            const done = index < deployStage;
            const current = index === deployStage;
            return (
              <li
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-300",
                  done && "border-buy/20 bg-buy/5",
                  current && "border-gold/40 bg-gold/8",
                  !done && !current && "border-white/8 bg-black/20",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-sm",
                    done && "text-buy",
                    current && "text-gold ox-router-pulse",
                    !done && !current && "text-white/30",
                  )}
                >
                  {done ? "✓" : current ? "◉" : "○"}
                </span>
                <span className={cn("text-sm", current && "font-semibold")}>{stage.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
