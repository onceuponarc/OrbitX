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
import type { ChainCapability } from "@/lib/custom-launch/onchain/types";

export type DeployPhase = "idle" | "confirming" | "running" | "ready" | "failed";

export type DeployResultView = {
  tokenAddress: string;
  poolAddress: string | null;
  launchId: string;
  slug: string;
  transaction: string;
  explorer: string | null;
};

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
  signedIn: boolean;
  handle: string | null;
  sessionLoading: boolean;
  capabilities: ChainCapability | null;
  canBroadcast: boolean;
  deployBlockedReason: string | null;
  deployPhase: DeployPhase;
  deployStage: number;
  deployResult: DeployResultView | null;
  deployError: string | null;
  openDeployConfirm: () => void;
  closeDeployConfirm: () => void;
  startDeploy: () => Promise<void>;
};

const CustomLaunchContext = createContext<CustomLaunchContextValue | null>(null);

export const DEPLOY_STAGES = [
  { id: "validate", label: "Validating configuration" },
  { id: "submit", label: "Submitting deployment" },
  { id: "confirm", label: "Waiting for chain confirmation" },
] as const;

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
  const [deployPhase, setDeployPhase] = useState<DeployPhase>("idle");
  const [deployStage, setDeployStage] = useState(0);
  const [deployResult, setDeployResult] = useState<DeployResultView | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<ChainCapability | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSessionLoading(true);
    fetch(`/api/custom-launch/capability?chain=${encodeURIComponent(chain)}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          signedIn?: boolean;
          handle?: string | null;
          capabilities?: ChainCapability;
          error?: string;
        };
        if (cancelled) return;
        setSignedIn(Boolean(body.signedIn));
        setHandle(body.handle ?? null);
        setCapabilities(body.capabilities ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setSignedIn(false);
        setCapabilities(null);
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chain]);

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
    setDeployResult(null);
    setDeployError(null);
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
    if (!signedIn) {
      setDeployError("Sign in before deploying a Custom Launch.");
      return;
    }
    if (capabilities && !capabilities.tokenCreate) {
      setDeployError(capabilities.note);
      return;
    }
    setDeployError(null);
    setDeployPhase("confirming");
  }, [capabilities, chain, signedIn]);

  const closeDeployConfirm = useCallback(() => {
    setDeployPhase((phase) => (phase === "confirming" ? "idle" : phase));
  }, []);

  const startDeploy = useCallback(async () => {
    const current = getCustomLaunchDraftSnapshot(chain);
    if (!launchIsReady(current)) return;
    if (!signedIn) {
      setDeployError("Sign in before deploying a Custom Launch.");
      setDeployPhase("failed");
      return;
    }
    if (capabilities && !capabilities.tokenCreate) {
      setDeployError(capabilities.note);
      setDeployPhase("failed");
      return;
    }
    setCustomLaunchDraft(chain, { ...current, reviewedAt: new Date().toISOString() });
    setDeployResult(null);
    setDeployError(null);
    setDeployStage(1);
    setDeployPhase("running");
    setStep("deploy");
    try {
      const response = await fetch("/api/custom-launch/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft: current }),
      });
      setDeployStage(2);
      const body = (await response.json()) as {
        error?: string;
        launchId?: string;
        slug?: string;
        tokenAddress?: string;
        poolAddress?: string | null;
        txHash?: string;
        explorer?: string | null;
      };
      if (!response.ok || !body.txHash || !body.tokenAddress || !body.launchId) {
        throw new Error(body.error || "Deployment did not confirm on-chain.");
      }
      setDeployStage(3);
      setDeployResult({
        tokenAddress: body.tokenAddress,
        poolAddress: body.poolAddress ?? null,
        launchId: body.launchId,
        slug: body.slug || body.launchId,
        transaction: body.txHash,
        explorer: body.explorer ?? null,
      });
      setDeployPhase("ready");
    } catch (error) {
      setDeployError(error instanceof Error ? error.message : "Custom Launch deployment failed.");
      setDeployPhase("failed");
    }
  }, [capabilities, chain, signedIn]);

  const value = useMemo<CustomLaunchContextValue>(() => {
    const reasons = [];
    if (!sessionLoading && !signedIn) {
      reasons.push("Sign in to broadcast this Custom Launch from your OrbitX desk.");
    }
    if (!sessionLoading && !capabilities) {
      reasons.push("Could not load chain capability.");
    } else if (!sessionLoading && capabilities && !capabilities.tokenCreate) {
      reasons.push(capabilities.note);
    }
    const deployBlockedReason = reasons.length ? reasons.join(" ") : null;
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
      signedIn,
      handle,
      sessionLoading,
      capabilities,
      canBroadcast: Boolean(signedIn && capabilities?.tokenCreate),
      deployBlockedReason,
      deployPhase,
      deployStage,
      deployResult,
      deployError,
      openDeployConfirm,
      closeDeployConfirm,
      startDeploy,
    };
  }, [
    capabilities,
    chain,
    closeDeployConfirm,
    deployError,
    deployPhase,
    deployResult,
    deployStage,
    draft,
    goAdjacent,
    handle,
    markReviewed,
    openDeployConfirm,
    patch,
    reset,
    sessionLoading,
    signedIn,
    startDeploy,
    step,
    update,
  ]);

  return <CustomLaunchContext.Provider value={value}>{children}</CustomLaunchContext.Provider>;
}

export function useCustomLaunch() {
  const ctx = useContext(CustomLaunchContext);
  if (!ctx) throw new Error("useCustomLaunch must be inside CustomLaunchDraftProvider");
  return ctx;
}

export function useStepStatus(id: CustomLaunchStepId) {
  const { draft } = useCustomLaunch();
  return stepStatus(draft, id);
}
