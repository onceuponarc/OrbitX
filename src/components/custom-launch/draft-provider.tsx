"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { PrintableChain } from "@onceupon/config/solana";
import {
  adjacentStep,
  configuredCount,
  CUSTOM_CHAIN_META,
  CUSTOM_LAUNCH_STEPS,
  incompleteSteps,
  requiredStepsComplete,
  stepStatus,
  type CustomLaunchDraft,
  type CustomLaunchStepId,
} from "@/lib/custom-launch/schema";
import {
  getCustomLaunchDraftServerSnapshot,
  getCustomLaunchDraftSnapshot,
  resetCustomLaunchDraft,
  setCustomLaunchDraft,
  subscribeCustomLaunchDraft,
} from "@/lib/custom-launch/draft";

type PatchSection = {
  [K in keyof CustomLaunchDraft]: CustomLaunchDraft[K] extends Record<string, unknown>
    ? K
    : never;
}[keyof CustomLaunchDraft];

type CustomLaunchContextValue = {
  chain: PrintableChain;
  meta: (typeof CUSTOM_CHAIN_META)[PrintableChain];
  draft: CustomLaunchDraft;
  step: CustomLaunchStepId;
  setStep: (id: CustomLaunchStepId) => void;
  goAdjacent: (delta: -1 | 1) => void;
  patch: <K extends PatchSection>(key: K, next: Partial<CustomLaunchDraft[K]>) => void;
  reset: () => void;
  markReviewed: () => void;
  configured: number;
  total: number;
  ready: boolean;
  missing: ReturnType<typeof incompleteSteps>;
};

const CustomLaunchContext = createContext<CustomLaunchContextValue | null>(null);

export function CustomLaunchDraftProvider({
  chain,
  children,
}: {
  chain: PrintableChain;
  children: ReactNode;
}) {
  const draft = useSyncExternalStore(
    (listener) => subscribeCustomLaunchDraft(chain, listener),
    () => getCustomLaunchDraftSnapshot(chain),
    () => getCustomLaunchDraftServerSnapshot(chain),
  );
  const [step, setStep] = useState<CustomLaunchStepId>("mode");

  const patch = useCallback(
    <K extends PatchSection>(key: K, next: Partial<CustomLaunchDraft[K]>) => {
      const current = getCustomLaunchDraftSnapshot(chain);
      setCustomLaunchDraft(chain, {
        ...current,
        reviewedAt: null,
        [key]: { ...current[key], ...next },
      });
    },
    [chain],
  );

  const reset = useCallback(() => {
    resetCustomLaunchDraft(chain);
    setStep("mode");
  }, [chain]);

  const markReviewed = useCallback(() => {
    const current = getCustomLaunchDraftSnapshot(chain);
    if (!requiredStepsComplete(current)) return;
    setCustomLaunchDraft(chain, { ...current, reviewedAt: new Date().toISOString() });
  }, [chain]);

  const goAdjacent = useCallback((delta: -1 | 1) => {
    setStep((current) => adjacentStep(current, delta) ?? current);
  }, []);

  const value = useMemo<CustomLaunchContextValue>(() => {
    return {
      chain,
      meta: CUSTOM_CHAIN_META[chain],
      draft,
      step,
      setStep,
      goAdjacent,
      patch,
      reset,
      markReviewed,
      configured: configuredCount(draft),
      total: CUSTOM_LAUNCH_STEPS.length,
      ready: requiredStepsComplete(draft),
      missing: incompleteSteps(draft),
    };
  }, [chain, draft, goAdjacent, markReviewed, patch, reset, step]);

  return <CustomLaunchContext.Provider value={value}>{children}</CustomLaunchContext.Provider>;
}

export function useCustomLaunch() {
  const ctx = useContext(CustomLaunchContext);
  if (!ctx) throw new Error("useCustomLaunch must be used inside CustomLaunchDraftProvider");
  return ctx;
}

export function useStepStatus(id: CustomLaunchStepId) {
  const { draft } = useCustomLaunch();
  return stepStatus(draft, id);
}
