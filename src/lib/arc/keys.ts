"use client";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { isAddress, isHex } from "viem";

export type ArcKeypair = {
  network: "devnet" | "mainnet";
  address: `0x${string}`;
  privateKey: `0x${string}`;
  createdAt: string;
};

const STORAGE = "onceupon.arc.keys.v1";

function empty(): { devnet: ArcKeypair | null; mainnet: ArcKeypair | null } {
  return { devnet: null, mainnet: null };
}

export function readArcKeys() {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as { devnet?: ArcKeypair | null; mainnet?: ArcKeypair | null };
    return { devnet: parsed.devnet ?? null, mainnet: parsed.mainnet ?? null };
  } catch {
    return empty();
  }
}

export function writeArcKeys(next: { devnet: ArcKeypair | null; mainnet: ArcKeypair | null }) {
  window.localStorage.setItem(STORAGE, JSON.stringify(next));
}

export function makeKey(network: "devnet" | "mainnet"): ArcKeypair {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    network,
    address: account.address,
    privateKey,
    createdAt: new Date().toISOString(),
  };
}

export function importKey(network: "devnet" | "mainnet", raw: string): ArcKeypair {
  const key = raw.trim() as `0x${string}`;
  if (!isHex(key) || key.length !== 66) throw new Error("Private key must be a 0x-prefixed 32-byte hex.");
  const account = privateKeyToAccount(key);
  return { network, address: account.address, privateKey: key, createdAt: new Date().toISOString() };
}

export function isEthAddress(value: string) {
  return isAddress(value);
}

export const ARC_NETWORKS = {
  devnet: {
    chainId: "0x7A69",
    chainName: "Arc",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["http://127.0.0.1:8546"],
    blockExplorerUrls: ["http://127.0.0.1:8546"],
  },
  testnet: {
    chainId: "0x4CEF52",
    chainName: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: ["https://rpc.testnet.arc.io"],
    blockExplorerUrls: ["https://testnet.arcscan.app"],
  },
  mainnet: {
    chainId: "0x13B2",
    chainName: "Arc",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: [
      "https://rpc.mainnet.arc.io",
      "https://rpc.arc-scan.org",
      "https://arc-mainnet.infura.io/v3/b6bf7d3508c941499b10025c0776eaf8",
    ],
    blockExplorerUrls: ["https://arcscan.app"],
  },
} as const;
