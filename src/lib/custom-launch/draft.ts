import type { PrintableChain } from "@onceupon/config/solana";
import { createCustomLaunchDraft, type CustomLaunchDraft } from "@/lib/custom-launch/schema";

export const CUSTOM_LAUNCH_STORAGE_PREFIX = "orbitx.custom-launch.v1.";

export function customLaunchStorageKey(chain: PrintableChain) {
  return `${CUSTOM_LAUNCH_STORAGE_PREFIX}${chain}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseCustomLaunchDraft(raw: unknown, chain: PrintableChain): CustomLaunchDraft | null {
  if (!isRecord(raw) || raw.version !== 1 || raw.chain !== chain) return null;
  const base = createCustomLaunchDraft(chain);
  if (!isRecord(raw.mode) || !isRecord(raw.token) || !isRecord(raw.economics)) return null;
  if (!isRecord(raw.primary) || !isRecord(raw.secondary) || !isRecord(raw.automation)) return null;

  return {
    ...base,
    mode: { ...base.mode, ...pick(raw.mode, base.mode) },
    token: { ...base.token, ...pick(raw.token, base.token) },
    economics: { ...base.economics, ...pick(raw.economics, base.economics) },
    primary: { ...base.primary, ...pick(raw.primary, base.primary) },
    secondary: { ...base.secondary, ...pick(raw.secondary, base.secondary) },
    automation: { ...base.automation, ...pick(raw.automation, base.automation) },
    reviewedAt: typeof raw.reviewedAt === "string" || raw.reviewedAt === null ? raw.reviewedAt : null,
  };
}

function pick<T extends Record<string, unknown>>(source: Record<string, unknown>, shape: T): Partial<T> {
  const next: Partial<T> = {};
  for (const key of Object.keys(shape) as (keyof T)[]) {
    if (!(key in source)) continue;
    const incoming = source[key as string];
    const current = shape[key];
    if (incoming === null || current === null || typeof incoming === typeof current) {
      next[key] = incoming as T[keyof T];
    }
  }
  return next;
}

export function readCustomLaunchDraft(chain: PrintableChain): CustomLaunchDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(customLaunchStorageKey(chain));
    if (!raw) return null;
    return parseCustomLaunchDraft(JSON.parse(raw), chain);
  } catch {
    return null;
  }
}

export function writeCustomLaunchDraft(chain: PrintableChain, draft: CustomLaunchDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(customLaunchStorageKey(chain), JSON.stringify(draft));
}

export function clearCustomLaunchDraft(chain: PrintableChain) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(customLaunchStorageKey(chain));
}

type Listener = () => void;

const listeners = new Map<PrintableChain, Set<Listener>>();
const snapshots = new Map<PrintableChain, CustomLaunchDraft>();

function emit(chain: PrintableChain) {
  listeners.get(chain)?.forEach((listener) => listener());
}

export function subscribeCustomLaunchDraft(chain: PrintableChain, listener: Listener) {
  let set = listeners.get(chain);
  if (!set) {
    set = new Set();
    listeners.set(chain, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export function getCustomLaunchDraftSnapshot(chain: PrintableChain) {
  const cached = snapshots.get(chain);
  if (cached) return cached;
  const draft = readCustomLaunchDraft(chain) ?? createCustomLaunchDraft(chain);
  snapshots.set(chain, draft);
  return draft;
}

const serverSnapshots = new Map<PrintableChain, CustomLaunchDraft>();

export function getCustomLaunchDraftServerSnapshot(chain: PrintableChain) {
  const cached = serverSnapshots.get(chain);
  if (cached) return cached;
  const draft = createCustomLaunchDraft(chain);
  serverSnapshots.set(chain, draft);
  return draft;
}

export function setCustomLaunchDraft(chain: PrintableChain, draft: CustomLaunchDraft) {
  snapshots.set(chain, draft);
  writeCustomLaunchDraft(chain, draft);
  emit(chain);
}

export function resetCustomLaunchDraft(chain: PrintableChain) {
  const draft = createCustomLaunchDraft(chain);
  snapshots.set(chain, draft);
  clearCustomLaunchDraft(chain);
  emit(chain);
}
