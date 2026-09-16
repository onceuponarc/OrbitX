import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_MAINNET, ARC_TESTNET, isPublicArc } from "@onceupon/config/arc";

/** Development addresses only. Private keys must be supplied through environment variables. */
export const ANVIL_DEPLOYER = {
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const,
};

export const ANVIL_TRADER = {
  address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const,
};

export type ArcNetworkFile = {
  label: string;
  rpcUrl: string;
  chainId: number;
  factory: `0x${string}`;
  usdc: `0x${string}`;
  trader: `0x${string}`;
  deployer: `0x${string}`;
  explorer: string;
  nativeGas: "usdc" | "eth";
};

const FILE = process.env.ARC_DEVNET_FILE || join(process.cwd(), "data", "arc-devnet.json");

const TESTNET_FACTORY = (ARC_TESTNET.factory ||
  "0x3FD6f451803CD0eC616da6Ef8228E6EC56C24086") as `0x${string}`;

export function loadArcNetwork(): ArcNetworkFile | null {
  if (process.env.ARC_FACTORY && process.env.ARC_USDC) {
    const chainId = Number(process.env.ARC_CHAIN_ID || 31337);
    return {
      label: "Arc",
      rpcUrl:
        process.env.ARC_RPC_URL ||
        (chainId === ARC_MAINNET.chainId
          ? ARC_MAINNET.rpcUrls[0]
          : chainId === ARC_TESTNET.chainId
            ? ARC_TESTNET.rpcUrls[0]
            : "http://127.0.0.1:8546"),
      chainId,
      factory: process.env.ARC_FACTORY as `0x${string}`,
      usdc: process.env.ARC_USDC as `0x${string}`,
      trader: (process.env.ARC_TRADER as `0x${string}`) || ANVIL_TRADER.address,
      deployer: (process.env.ARC_DEPLOYER as `0x${string}`) || ANVIL_DEPLOYER.address,
      explorer:
        process.env.ARC_EXPLORER ||
        (chainId === ARC_MAINNET.chainId ? ARC_MAINNET.explorer : ARC_TESTNET.explorer),
      nativeGas: isPublicArc(chainId) ? "usdc" : "eth",
    };
  }
  if (process.env.VERCEL || process.env.ARC_CHAIN_ID === String(ARC_MAINNET.chainId) || process.env.ARC_CHAIN_ID === String(ARC_TESTNET.chainId)) {
    const main = process.env.ARC_CHAIN_ID !== String(ARC_TESTNET.chainId);
    const net = main ? ARC_MAINNET : ARC_TESTNET;
    return {
      label: net.name,
      rpcUrl: process.env.ARC_RPC_URL || net.rpcUrls[0],
      chainId: net.chainId,
      factory: (process.env.ARC_FACTORY as `0x${string}` | undefined) || TESTNET_FACTORY,
      usdc: (process.env.ARC_USDC as `0x${string}` | undefined) || net.usdcErc20,
      trader: (process.env.ARC_TRADER as `0x${string}`) || "0xAce02417493B6E28431E5AdbBAfEdc6D1007E7b7",
      deployer: (process.env.ARC_DEPLOYER as `0x${string}`) || "0xAce02417493B6E28431E5AdbBAfEdc6D1007E7b7",
      explorer: process.env.ARC_EXPLORER || net.explorer,
      nativeGas: "usdc",
    };
  }
  if (!existsSync(FILE)) return null;
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as ArcNetworkFile;
  } catch {
    return null;
  }
}

const BLOCKED_ANVIL = ANVIL_TRADER.address.toLowerCase();

function readKey(...names: string[]): `0x${string}` | null {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const hex = raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`;
    if (/^0x[0-9a-fA-F]{64}$/.test(hex)) return hex as `0x${string}`;
  }
  return null;
}

function privateKeyAddress(key: `0x${string}`): `0x${string}` {
  return privateKeyToAccount(key).address;
}

function onPublicArc() {
  return (
    Boolean(process.env.VERCEL) ||
    process.env.ARC_CHAIN_ID === String(ARC_MAINNET.chainId) ||
    process.env.ARC_CHAIN_ID === String(ARC_TESTNET.chainId)
  );
}

export function traderPrivateKey(): `0x${string}` {
  const fromEnv = readKey("ARC_DEV_PRIVATE_KEY", "ARC_TRADER_PRIVATE_KEY", "ARC_DEPLOYER_PRIVATE_KEY");
  if (onPublicArc() && !fromEnv) {
    throw new Error("Public Arc signer is not configured. Set ARC_DEV_PRIVATE_KEY or ARC_TRADER_PRIVATE_KEY.");
  }
  if (!fromEnv) throw new Error("Arc signer is not configured.");
  return fromEnv;
}

export function deployerPrivateKey(): `0x${string}` {
  const fromEnv = readKey("ARC_DEPLOYER_PRIVATE_KEY", "ARC_DEV_PRIVATE_KEY");
  if (onPublicArc() && !fromEnv) {
    throw new Error("Public Arc deployer signer is not configured. Set ARC_DEPLOYER_PRIVATE_KEY.");
  }
  if (!fromEnv) throw new Error("Arc deployer signer is not configured.");
  return fromEnv;
}

export function padSignerAddress(): `0x${string}` {
  if (onPublicArc()) {
    const key = traderPrivateKey();
    return privateKeyAddress(key);
  }
  throw new Error("Arc signer is not configured.");
}

export function assertUnblockedSigner(address: string) {
  if (onPublicArc() && address.toLowerCase() === BLOCKED_ANVIL) {
    throw new Error("Arc Testnet blocked the Anvil pad wallet. Set ARC_DEV_PRIVATE_KEY to the funded Testnet key.");
  }
}

export function arcDevnetPath() {
  return FILE;
}
