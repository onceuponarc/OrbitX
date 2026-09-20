/**
 * Per-chain OrbitX revenue fee configuration.
 *
 * Doc 3 PHASE 8 shipped Arc at $0 / 0% with "revenue wallet: none", and required
 * that the fee system be structured so "Arc can be monetized later through
 * configuration rather than requiring a major rewrite". This module is that
 * structure: a chain is monetized by changing a value here (or its env
 * override), never by editing a trade route.
 *
 * PHASE 8's standing prohibitions are kept as executable guards below rather
 * than as prose, so they survive future edits: no zero address, no placeholder,
 * and no mixing a Solana revenue wallet into an EVM chain (or the reverse).
 * Arc and Robinhood Chain may share the same EVM EOA when the owner supplies it
 * for both.
 */

export type ChainKey = "solana" | "rh" | "arc";

export type ChainFeeConfig = {
  chain: ChainKey;
  /** Trading fee in basis points. 0 disables trade fees for the chain. */
  tradeFeeBps: number;
  /** Launch fee in USD. 0 disables the launch fee for the chain. */
  launchFeeUsd: number;
  /** Where revenue is sent. null means the chain is deliberately unmonetized. */
  revenueWallet: string | null;
  /** Decimals of the asset fees are denominated in (Arc USDC ERC-20 = 6). */
  feeAssetDecimals: number;
  addressFormat: "base58" | "evm";
};

const SOLANA_REVENUE_WALLET = "2WpoUM5YHKZF6xWM7qDx5f7gFGtNtkAJyQM8dU44CzDs";

/**
 * Owner-supplied EVM revenue wallet (Arc 2026-09-16, Robinhood Chain 2026-09-20).
 * EIP-55 checksum verified before use; see assertUsableRevenueWallet.
 */
const EVM_REVENUE_WALLET = "0xC1149913d96546c86956f042e4Ac9e9ad192f55F";
const ARC_REVENUE_WALLET = EVM_REVENUE_WALLET;
const RH_REVENUE_WALLET = EVM_REVENUE_WALLET;

function envNumber(name: string): number | null {
  const raw = process.env?.[name];
  if (raw === undefined || raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} is not a usable number: ${raw}`);
  }
  return value;
}

function envString(name: string): string | null {
  const raw = process.env?.[name];
  return raw && raw.trim() !== "" ? raw.trim() : null;
}

const DEFAULTS: Record<ChainKey, ChainFeeConfig> = {
  solana: {
    chain: "solana",
    tradeFeeBps: 20,
    launchFeeUsd: 0.25,
    revenueWallet: SOLANA_REVENUE_WALLET,
    feeAssetDecimals: 9,
    addressFormat: "base58",
  },
  rh: {
    chain: "rh",
    tradeFeeBps: 20,
    launchFeeUsd: 0.25,
    revenueWallet: RH_REVENUE_WALLET,
    feeAssetDecimals: 18,
    addressFormat: "evm",
  },
  arc: {
    chain: "arc",
    tradeFeeBps: 20,
    launchFeeUsd: 0.25,
    revenueWallet: ARC_REVENUE_WALLET,
    // Chapters quote in USDC ERC-20 (6dp), NOT Arc's 18dp native USDC gas token.
    feeAssetDecimals: 6,
    addressFormat: "evm",
  },
};

const ENV_PREFIX: Record<ChainKey, string> = {
  solana: "ORBITX_SOLANA",
  rh: "ORBITX_RH",
  arc: "ORBITX_ARC",
};

export function chainFeeConfig(chain: ChainKey): ChainFeeConfig {
  const base = DEFAULTS[chain];
  if (!base) throw new Error(`Unknown chain: ${chain}`);
  const prefix = ENV_PREFIX[chain];
  const bps = envNumber(`${prefix}_TRADE_FEE_BPS`);
  const usd = envNumber(`${prefix}_LAUNCH_FEE_USD`);
  const wallet = envString(`${prefix}_REVENUE_WALLET`);
  return {
    ...base,
    tradeFeeBps: bps === null ? base.tradeFeeBps : Math.trunc(bps),
    launchFeeUsd: usd === null ? base.launchFeeUsd : usd,
    revenueWallet: wallet ?? base.revenueWallet,
  };
}

/** True only when the chain has both a nonzero rate and somewhere to send it. */
export function tradeFeesEnabled(chain: ChainKey): boolean {
  const cfg = chainFeeConfig(chain);
  return cfg.tradeFeeBps > 0 && Boolean(cfg.revenueWallet);
}

export function launchFeesEnabled(chain: ChainKey): boolean {
  const cfg = chainFeeConfig(chain);
  return cfg.launchFeeUsd > 0 && Boolean(cfg.revenueWallet);
}

const EVM_ZERO = "0x0000000000000000000000000000000000000000";
const EVM_DEAD = "0x000000000000000000000000000000000000dEaD";

/**
 * PHASE 8's prohibitions, enforced. Format-level only — the strict EIP-55
 * checksum assertion lives with the Arc client, which already has keccak.
 */
export function assertUsableRevenueWallet(chain: ChainKey, wallet: string | null): string {
  if (!wallet) {
    throw new Error(`No OrbitX revenue wallet configured for ${chain}; refusing to collect a fee.`);
  }
  const cfg = DEFAULTS[chain];
  if (cfg.addressFormat === "evm") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      throw new Error(`${chain} revenue wallet is not a valid address: ${wallet}`);
    }
    const lower = wallet.toLowerCase();
    if (lower === EVM_ZERO.toLowerCase() || lower === EVM_DEAD.toLowerCase()) {
      throw new Error(`Refusing to send ${chain} revenue to the zero/burn address.`);
    }
    if (/^0x0+$/.test(lower) || /^0x(1234|dead|beef|abcd)/.test(lower)) {
      throw new Error(`${chain} revenue wallet looks like a placeholder: ${wallet}`);
    }
  } else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    throw new Error(`${chain} revenue wallet is not valid base58: ${wallet}`);
  }

  // Do not send Solana revenue to an EVM wallet or EVM revenue to Solana.
  // Arc and Robinhood Chain may share one owner EOA.
  for (const [key, other] of Object.entries(DEFAULTS) as [ChainKey, ChainFeeConfig][]) {
    if (key === chain || !other.revenueWallet) continue;
    if (other.addressFormat === cfg.addressFormat) continue;
    if (other.revenueWallet.toLowerCase() === wallet.toLowerCase()) {
      throw new Error(`Refusing to use the ${key} revenue wallet on ${chain}.`);
    }
  }
  return wallet;
}

/** UI-facing rate string, e.g. "0.20%". */
export function feeRateLabel(chain: ChainKey): string {
  return `${(chainFeeConfig(chain).tradeFeeBps / 100).toFixed(2)}%`;
}
