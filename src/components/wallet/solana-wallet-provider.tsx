"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { injectedAddress } from "@/lib/wallets/injected-address";

type Injected = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  isJupiter?: boolean;
  publicKey?: { toBase58(): string } | string | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<unknown>;
  disconnect?: () => Promise<void>;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  signAndSendTransaction?: (tx: unknown, opts?: unknown) => Promise<unknown>;
  sendTransaction?: (tx: unknown, connection: unknown, opts?: unknown) => Promise<unknown>;
  signAllTransactions?: (txs: unknown[]) => Promise<unknown>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array } | Uint8Array>;
};

type DetectedWallet = { id: string; name: string; provider: Injected };

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin);
}

type WalletState = {
  wallets: DetectedWallet[];
  address: string | null;
  connecting: boolean;
  bound: boolean;
  error: string | null;
  connect: (id?: string) => Promise<string | null>;
  disconnect: () => Promise<void>;
  ensureBound: () => Promise<string>;
  signTransaction: (tx: unknown) => Promise<unknown>;
  signAndSendTransaction: (tx: unknown) => Promise<unknown>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};

const empty: WalletState = {
  wallets: [],
  address: null,
  connecting: false,
  bound: false,
  error: null,
  connect: async () => null,
  disconnect: async () => undefined,
  ensureBound: async () => {
    throw new Error("Connect a Solana wallet.");
  },
  signTransaction: async () => {
    throw new Error("Connect a Solana wallet.");
  },
  signAndSendTransaction: async () => {
    throw new Error("Connect a Solana wallet.");
  },
  signMessage: async () => {
    throw new Error("Connect a Solana wallet.");
  },
};

const WalletContext = createContext<WalletState>(empty);

function detect(): DetectedWallet[] {
  if (typeof window === "undefined") return [];
  const list: DetectedWallet[] = [];
  const phantom = (window as Window & { phantom?: { solana?: Injected } }).phantom?.solana;
  const solana = (window as Window & { solana?: Injected }).solana;
  const solflare = (window as Window & { solflare?: Injected }).solflare;
  const backpack = (window as Window & { backpack?: Injected }).backpack;
  const jupiterRoot = (window as Window & { jupiter?: { solana?: Injected } }).jupiter;
  const jupiter = jupiterRoot?.solana;
  const add = (id: string, name: string, provider?: Injected) => {
    if (provider && !list.some((item) => item.id === id)) list.push({ id, name, provider });
  };
  add("phantom", "Phantom", phantom ?? (solana?.isPhantom ? solana : undefined));
  add("solflare", "Solflare", solflare);
  add("backpack", "Backpack", backpack);
  add("jupiter", "Jupiter Wallet", jupiter);
  return list;
}

function readSignatureBytes(result: unknown): Uint8Array {
  if (result instanceof Uint8Array) return result;
  if (result && typeof result === "object" && "signature" in result) {
    const signature = (result as { signature: Uint8Array }).signature;
    if (signature instanceof Uint8Array) return signature;
  }
  throw new Error("Wallet did not return a signature.");
}

async function bindToSupabase(address: string, signMessage: (msg: Uint8Array) => Promise<Uint8Array>) {
  const issuedAt = new Date().toISOString();
  const me = await fetch("/api/me").then((res) => res.json().catch(() => ({})));
  if (!me?.id) throw new Error("Sign in with X first. Your handle is identity on the pad.");
  const message = new TextEncoder().encode(`OrbitX:${me.id}:${issuedAt}`);
  const signature = await signMessage(message);
  const bytes = signature instanceof Uint8Array ? signature : new Uint8Array(signature as ArrayBuffer);
  const res = await fetch("/api/wallets/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      issuedAt,
      signature: bytesToBase64(bytes),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Wallet bind failed.");
}

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [bound, setBound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const scan = () => setWallets(detect());
    scan();
    const t = window.setInterval(scan, 2500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (address) return;
    for (const item of wallets) {
      const existing = injectedAddress(item.provider.publicKey) ?? injectedAddress(item.provider);
      if (existing) {
        setActiveId(item.id);
        setAddress(existing);
        break;
      }
    }
  }, [wallets, address]);

  const active = wallets.find((item) => item.id === activeId) ?? wallets[0];

  const resolveAddress = useCallback(async (provider: Injected, connected?: unknown) => {
    return (
      injectedAddress(connected) ??
      injectedAddress(provider.publicKey) ??
      injectedAddress(provider)
    );
  }, []);

  const ensureSession = useCallback(
    async (provider = active?.provider) => {
      if (!provider) throw new Error("Connect a Solana wallet.");
      let connected: unknown = null;
      try {
        connected = await provider.connect({ onlyIfTrusted: true });
      } catch {
        connected = await provider.connect({ onlyIfTrusted: false });
      }
      const next = await resolveAddress(provider, connected);
      if (!next) {
        throw new Error("Wallet connected but did not return an address. Unlock it and try again.");
      }
      setAddress(next);
      return { provider, address: next };
    },
    [active, resolveAddress],
  );

  const signMessage = useCallback(
    async (message: Uint8Array) => {
      const session = await ensureSession();
      if (!session.provider.signMessage) throw new Error("This wallet cannot sign a message.");
      return readSignatureBytes(await session.provider.signMessage(message));
    },
    [ensureSession],
  );

  const connect = useCallback(
    async (id?: string) => {
      const target = (id ? wallets.find((item) => item.id === id) : wallets[0]) ?? detect()[0];
      if (!target) {
        setError("Install Phantom, Solflare, or Backpack.");
        return null;
      }
      setConnecting(true);
      setError(null);
      try {
        setActiveId(target.id);
        const session = await ensureSession(target.provider);
        try {
          await bindToSupabase(session.address, async (message) =>
            readSignatureBytes(
              target.provider.signMessage
                ? await target.provider.signMessage(message)
                : Promise.reject(new Error("This wallet cannot sign a message.")),
            ),
          );
          setBound(true);
        } catch (bindError) {
          setBound(false);
          setError(bindError instanceof Error ? bindError.message : "Wallet bind failed.");
        }
        return session.address;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Wallet connect failed.");
        return null;
      } finally {
        setConnecting(false);
      }
    },
    [ensureSession, wallets],
  );

  const disconnect = useCallback(async () => {
    try {
      await active?.provider.disconnect?.();
    } catch {
      // ignore
    }
    setAddress(null);
    setActiveId(null);
    setBound(false);
  }, [active]);

  const signTransaction = useCallback(
    async (tx: unknown) => {
      const session = await ensureSession();
      if (typeof session.provider.signTransaction !== "function") {
        throw new Error("This wallet cannot sign a transaction. Use a wallet that can sign and pay.");
      }
      return session.provider.signTransaction(tx);
    },
    [ensureSession],
  );

  const signAndSendTransaction = useCallback(
    async (tx: unknown) => {
      const session = await ensureSession();
      if (typeof session.provider.signAndSendTransaction === "function") {
        return session.provider.signAndSendTransaction(tx);
      }
      if (typeof session.provider.signTransaction === "function") {
        return { signed: await session.provider.signTransaction(tx) };
      }
      throw new Error("This wallet cannot sign and pay a transaction.");
    },
    [ensureSession],
  );

  const ensureBound = useCallback(async () => {
    const session = await ensureSession();
    const me = await fetch("/api/wallets/me").then((res) => res.json().catch(() => ({})));
    if (me?.bound && me.address === session.address) {
      setBound(true);
      return session.address;
    }
    if (me?.bound && me.address && me.address !== session.address) {
      throw new Error("Sign with the Solana wallet bound to this X account.");
    }
    await bindToSupabase(session.address, async (message) => {
      if (!session.provider.signMessage) throw new Error("This wallet cannot sign a message.");
      return readSignatureBytes(await session.provider.signMessage(message));
    });
    setBound(true);
    setError(null);
    return session.address;
  }, [ensureSession]);

  const value = useMemo(
    () => ({
      wallets,
      address,
      connecting,
      bound,
      error,
      connect,
      disconnect,
      ensureBound,
      signTransaction,
      signAndSendTransaction,
      signMessage,
    }),
    [
      wallets,
      address,
      connecting,
      bound,
      error,
      connect,
      disconnect,
      ensureBound,
      signTransaction,
      signAndSendTransaction,
      signMessage,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useSolanaWallet() {
  return useContext(WalletContext);
}
