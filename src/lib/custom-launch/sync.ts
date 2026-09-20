import "server-only";

import { createPublicClient, http, type Address } from "viem";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { solanaConnection } from "@/lib/solana/connection";
import { WSOL_MINT } from "@/lib/solana/jupiter";
import { loadArcNetwork } from "@/lib/arc/env";
import { RH } from "@onceupon/config/rh";
import { DEST_INDEX, POOL_ABI } from "@/lib/custom-launch/onchain/abi";
import { readHubBalance } from "@/lib/custom-launch/onchain/evm";
import type { LiveReadings } from "@/lib/custom-launch/engine";
import {
  loadVaults,
  updateVaultBalances,
  type LaunchRow,
} from "@/lib/custom-launch/persist";

export type VaultBalanceRow = {
  dest: string;
  quote_balance: string;
  token_balance: string;
  chain_address: string | null;
  synced_at: string | null;
};

export type ReadingSource = "chain" | "unavailable";

export type LiveLaunchReadings = LiveReadings & {
  source: {
    feeBalance: ReadingSource;
    marketCap: ReadingSource;
    volume: ReadingSource;
    holders: ReadingSource;
    liquidity: ReadingSource;
  };
  notes: string[];
};

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function destIndex(dest: string): number | null {
  if (dest === "custom") return DEST_INDEX.community;
  const idx = DEST_INDEX[dest as keyof typeof DEST_INDEX];
  return typeof idx === "number" ? idx : null;
}

function humanAmount(raw: bigint, decimals: number) {
  if (decimals <= 0) return Number(raw);
  return Number(raw) / 10 ** decimals;
}

async function solanaAtaBalance(mint: string, owner: string, program: typeof TOKEN_PROGRAM_ID) {
  const conn = solanaConnection();
  const ata = getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner), false, program);
  const info = await conn.getTokenAccountBalance(ata).catch(() => null);
  return BigInt(info?.value.amount ?? "0");
}

function evmRpc(chain: LaunchRow["chain"]) {
  if (chain === "robinhood") return RH.rpcUrl;
  return loadArcNetwork()?.rpcUrl ?? null;
}

function quoteDecimals(launch: LaunchRow) {
  if (launch.chain === "solana") return launch.quote_address === SOLANA_USDC ? 6 : 9;
  return 6;
}

export async function syncLaunchVaults(launch: LaunchRow): Promise<VaultBalanceRow[]> {
  const vaults = await loadVaults(launch.id);
  if (!launch.token_address) return vaults as VaultBalanceRow[];
  if (launch.chain === "solana") {
    for (const vault of vaults) {
      const owner = (vault.chain_address as string | null) || "";
      if (!owner) continue;
      const token = await solanaAtaBalance(launch.token_address, owner, TOKEN_2022_PROGRAM_ID);
      let quote = 0n;
      if (launch.quote_address === SOLANA_USDC) {
        quote = await solanaAtaBalance(SOLANA_USDC, owner, TOKEN_PROGRAM_ID);
      } else {
        const native = BigInt(await solanaConnection().getBalance(new PublicKey(owner)).catch(() => 0));
        const wsol = await solanaAtaBalance(WSOL_MINT, owner, TOKEN_PROGRAM_ID);
        quote = native + wsol;
      }
      await updateVaultBalances(launch.id, vault.dest as string, quote.toString(), token.toString());
    }
    return (await loadVaults(launch.id)) as VaultBalanceRow[];
  }
  if (!launch.hub_address || !launch.quote_address) return vaults as VaultBalanceRow[];
  const rpc = evmRpc(launch.chain);
  if (!rpc) return vaults as VaultBalanceRow[];
  for (const vault of vaults) {
    const idx = destIndex(vault.dest as string);
    if (idx == null) continue;
    const quote = await readHubBalance(rpc, launch.hub_address as Address, idx, launch.quote_address as Address);
    const token = await readHubBalance(rpc, launch.hub_address as Address, idx, launch.token_address as Address);
    await updateVaultBalances(launch.id, vault.dest as string, quote.toString(), token.toString());
  }
  return (await loadVaults(launch.id)) as VaultBalanceRow[];
}

async function poolReserves(launch: LaunchRow): Promise<{ token: bigint; quote: bigint } | null> {
  if (!launch.pool_address) return null;
  if (launch.chain === "solana") {
    if (!launch.token_address || !launch.quote_address) return null;
    const token = await solanaAtaBalance(launch.token_address, launch.pool_address, TOKEN_2022_PROGRAM_ID);
    const quote = await solanaAtaBalance(launch.quote_address, launch.pool_address, TOKEN_PROGRAM_ID);
    if (token <= 0n && quote <= 0n) return null;
    return { token, quote };
  }
  const rpc = evmRpc(launch.chain);
  if (!rpc) return null;
  const pub = createPublicClient({ transport: http(rpc) });
  const [token, quote] = await Promise.all([
    pub.readContract({ address: launch.pool_address as Address, abi: POOL_ABI, functionName: "reserveToken" }),
    pub.readContract({ address: launch.pool_address as Address, abi: POOL_ABI, functionName: "reserveQuote" }),
  ]);
  return { token, quote };
}

export async function liveReadingsForLaunch(
  launch: LaunchRow,
  vaults?: { dest?: string; quote_balance?: string | number | null; token_balance?: string | number | null }[],
): Promise<LiveLaunchReadings> {
  const notes: string[] = [];
  const rows = vaults ?? (await loadVaults(launch.id));
  const quoteDec = quoteDecimals(launch);
  let feeRaw = 0n;
  for (const row of rows) {
    feeRaw += BigInt(row.quote_balance || "0");
  }
  const feeBalance = humanAmount(feeRaw, quoteDec);
  const source: LiveLaunchReadings["source"] = {
    feeBalance: rows.length ? "chain" : "unavailable",
    marketCap: "unavailable",
    volume: "unavailable",
    holders: "unavailable",
    liquidity: "unavailable",
  };
  notes.push("Volume and holder count are not indexed. Those conditions stay at 0 unless you enter readings.");
  let liquidity = 0;
  let marketCap = 0;
  const reserves = await poolReserves(launch).catch(() => null);
  if (reserves && reserves.token > 0n) {
    liquidity = humanAmount(reserves.quote, quoteDec);
    source.liquidity = "chain";
    const supply = BigInt(launch.supply || "0") * 10n ** BigInt(launch.decimals || 0);
    marketCap = humanAmount((reserves.quote * supply) / reserves.token, quoteDec);
    source.marketCap = "chain";
  } else if (!launch.pool_address) {
    notes.push("No Custom Launch pool address, so market cap and liquidity readings are unavailable.");
  }
  return {
    feeBalance,
    marketCap,
    volume: 0,
    holders: 0,
    liquidity,
    now: Date.now(),
    source,
    notes,
  };
}
