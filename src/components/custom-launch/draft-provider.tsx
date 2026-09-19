"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { PrintableChain } from "@onceupon/config/solana";
import {
  createMockDeployResult,
  MOCK_DEPLOY_STAGES,
  type MockDeployResult,
} from "@/lib/custom-launch/mock-deploy";
import { launchIsReady } from "@/lib/custom-launch/readiness";
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

export type MockDeployPhase = "idle" | "confirming" | "running" | "ready";

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
  update: (fn: (draft: CustomLaunchDraft) => CustomLaunchDraft) => void;
  reset: () => void;
  markReviewed: () => void;
  configured: number;
  total: number;
  ready: boolean;
  missing: ReturnType<typeof incompleteSteps>;
  deployPhase: MockDeployPhase;
  deployStage: number;
  mockResult: MockDeployResult | null;
  openDeployConfirm: () => void;
  closeDeployConfirm: () => void;
  startMockDeploy: () => void;
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
  const [deployPhase, setDeployPhase] = useState<MockDeployPhase>("idle");
  const [deployStage, setDeployStage] = useState(0);
  const [mockResult, setMockResult] = useState<MockDeployResult | null>(null);

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

  const update = useCallback((fn: (draft: CustomLaunchDraft) => CustomLaunchDraft) => {
    const current = getCustomLaunchDraftSnapshot(chain);
    setCustomLaunchDraft(chain, { ...fn(current), reviewedAt: null });
  }, [chain]);

  const reset = useCallback(() => {
    resetCustomLaunchDraft(chain);
    setStep("mode");
    setDeployPhase("idle");
    setDeployStage(0);
    setMockResult(null);
  }, [chain]);

  const markReviewed = useCallback(() => {
    const current = getCustomLaunchDraftSnapshot(chain);
    if (!requiredStepsComplete(current)) return;
    setCustomLaunchDraft(chain, { ...current, reviewedAt: new Date().toISOString() });
  }, [chain]);

  const goAdjacent = useCallback((delta: -1 | 1) => {
    setStep((current) => adjacentStep(current, delta) ?? current);
  }, []);

  const openDeployConfirm = useCallback(() => {
    const current = getCustomLaunchDraftSnapshot(chain);
    if (!launchIsReady(current)) return;
    setDeployPhase("confirming");
  }, [chain]);

  const closeDeployConfirm = useCallback(() => {
    setDeployPhase((phase) => (phase === "confirming" ? "idle" : phase));
  }, []);

  const startMockDeploy = useCallback(() => {
    const current = getCustomLaunchDraftSnapshot(chain);
    if (!launchIsReady(current)) return;
    setCustomLaunchDraft(chain, { ...current, reviewedAt: new Date().toISOString() });
    setMockResult(createMockDeployResult(current.token.symbol, current.chain, current.markets.primary.quote));
    setDeployStage(0);
    setDeployPhase("running");
    setStep("deploy");
  }, [chain]);

  useEffect(() => {
    if (deployPhase !== "running") return;
    if (deployStage >= MOCK_DEPLOY_STAGES.length) {
      setDeployPhase("ready");
      return;
    }
    const timer = window.setTimeout(() => setDeployStage((value) => value + 1), 480);
    return () => window.clearTimeout(timer);
  }, [deployPhase, deployStage]);

  const value = useMemo<CustomLaunchContextValue>(() => {
    return {
      chain,
      meta: CUSTOM_CHAIN_META[chain],
      draft,
      step,
      setStep,
      goAdjacent,
      patch,
      update,
      reset,
      markReviewed,
      configured: configuredCount(draft),
      total: CUSTOM_LAUNCH_STEPS.length,
      ready: launchIsReady(draft),
      missing: incompleteSteps(draft),
      deployPhase,
      deployStage,
      mockResult,
      openDeployConfirm,
      closeDeployConfirm,
      startMockDeploy,
    };
  }, [
    chain,
    closeDeployConfirm,
    deployPhase,
    deployStage,
    draft,
    goAdjacent,
    markReviewed,
    mockResult,
    openDeployConfirm,
    patch,
    reset,
    startMockDeploy,
    step,
    update,
  ]);

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
