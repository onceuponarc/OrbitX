import "server-only";

import {
  formatUnits,
  keccak256,
  maxUint256,
  parseEventLogs,
  parseUnits,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { prepareArgusLaunch } from "@/lib/arc/argus-hook";

export const ARGUS_PORTAL7 = "0xB021Be536808f551b31789422Fd28a6c9c6e97Da" as Address;
export const ARGUS_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as Address;
export const ARGUS_TREASURY = "0x934dEa9aB179DE155db10519AA89A8c418c50705" as Address;
export const ARGUS_TOKEN_IMPL = "0x1b74922c01DdFd9c77b37d02c0a236611E8FE500" as Address;
export const ARGUS_LOCKER_IMPL = "0xB2Ed8112DB1BC11F7E7ab7969c2A9d1F819Cfc6A" as Address;
export const ARGUS_SPLITTER_IMPL = "0xD9578Dd861B2fe59675c2C4B09b026fcB0dF37fc" as Address;
export const ARC_USDC = "0x3600000000000000000000000000000000000000" as Address;
export const ARC_STATE_VIEW = "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b" as Address;

/** Live Argus Portal #7 defaults (start/bond FDV in 6-decimal USDC). */
export const ARGUS_TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
export const ARGUS_START_FDV_USDC6 = 2_500n * 10n ** 6n;
export const ARGUS_BOND_FDV_USDC6 = 45_000n * 10n ** 6n;
/** Native Arc USDC is 18 decimals; the 0x3600 ERC-20 view is 6 decimals. */
export const ARGUS_DEFAULT_SEED_USDC = 10;
export const ARGUS_MIN_SEED_USDC = 1;
export const ARGUS_MAX_SEED_USDC = 1_000;
export const ARGUS_GAS_BUFFER_NATIVE = 10n ** 18n;

const ERC20_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const STATE_VIEW_LIQ_ABI = [
  { type: "function", name: "getLiquidity", stateMutability: "view", inputs: [{ name: "poolId", type: "bytes32" }], outputs: [{ type: "uint128" }] },
] as const;

const portalViewsAbi = [
  { type: "function", name: "tokenImpl", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "splitterImpl", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "poolManager", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "POOL_FEE", stateMutability: "view", inputs: [], outputs: [{ type: "uint24" }] },
  { type: "function", name: "TICK_SPACING", stateMutability: "view", inputs: [], outputs: [{ type: "int24" }] },
] as const;

export const ARGUS_PORTAL7_ABI = [
  { type: "function", name: "launch", stateMutability: "payable", inputs: [{ name: "p", type: "tuple", components: [
    { name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "totalSupply", type: "uint256" },
    { name: "startFdvUsdc6", type: "uint256" }, { name: "bondFdvUsdc6", type: "uint256" },
    { name: "buyTaxBps", type: "uint16" }, { name: "sellTaxBps", type: "uint16" }, { name: "creatorBps", type: "uint16" },
    { name: "burnBps", type: "uint16" }, { name: "dividendBps", type: "uint16" }, { name: "liquidityBps", type: "uint16" },
    { name: "devBuyQuote", type: "uint256" }, { name: "quoteAsset", type: "address" }, { name: "expectConvert", type: "uint8" },
  ] }, { name: "meta", type: "tuple", components: [
    { name: "imageURI", type: "string" }, { name: "website", type: "string" }, { name: "twitter", type: "string" },
    { name: "telegram", type: "string" }, { name: "description", type: "string" },
  ] }, { name: "salt", type: "bytes32" }, { name: "hookSalt", type: "bytes32" }], outputs: [{ name: "token", type: "address" }] },
  { type: "event", name: "TokenCreated", anonymous: false, inputs: [
    { name: "token", type: "address", indexed: true }, { name: "creator", type: "address", indexed: true },
    { name: "name", type: "string", indexed: false }, { name: "symbol", type: "string", indexed: false },
    { name: "poolId", type: "bytes32", indexed: false }, { name: "imageURI", type: "string", indexed: false },
    { name: "website", type: "string", indexed: false }, { name: "twitter", type: "string", indexed: false },
    { name: "telegram", type: "string", indexed: false },
  ] },
  { type: "function", name: "launches", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [
    { name: "creator", type: "address" }, { name: "tickStart", type: "int24" }, { name: "tokenIsToken0", type: "bool" },
    { name: "locker", type: "address" }, { name: "hook", type: "address" }, { name: "splitter", type: "address" },
    { name: "buyTaxBps", type: "uint16" }, { name: "sellTaxBps", type: "uint16" }, { name: "positionId", type: "uint256" },
    { name: "tickBond", type: "int24" }, { name: "quoteAsset", type: "address" },
  ] },
] as const;

async function readPortalConfig(pub: PublicClient) {
  try {
    const [tokenImpl, splitterImpl, poolManager, treasury, poolFee, tickSpacing] = await Promise.all([
      pub.readContract({ address: ARGUS_PORTAL7, abi: portalViewsAbi, functionName: "tokenImpl" }),
      pub.readContract({ address: ARGUS_PORTAL7, abi: portalViewsAbi, functionName: "splitterImpl" }),
      pub.readContract({ address: ARGUS_PORTAL7, abi: portalViewsAbi, functionName: "poolManager" }),
      pub.readContract({ address: ARGUS_PORTAL7, abi: portalViewsAbi, functionName: "treasury" }),
      pub.readContract({ address: ARGUS_PORTAL7, abi: portalViewsAbi, functionName: "POOL_FEE" }),
      pub.readContract({ address: ARGUS_PORTAL7, abi: portalViewsAbi, functionName: "TICK_SPACING" }),
    ]);
    return {
      tokenImpl, splitterImpl, poolManager, treasury,
      poolFee: Number(poolFee), tickSpacing: Number(tickSpacing),
    };
  } catch {
    return {
      tokenImpl: ARGUS_TOKEN_IMPL, splitterImpl: ARGUS_SPLITTER_IMPL,
      poolManager: ARGUS_POOL_MANAGER, treasury: ARGUS_TREASURY,
      poolFee: 10_000, tickSpacing: 200,
    };
  }
}

function randomSalt(): Hex {
  return keccak256(toHex(crypto.getRandomValues(new Uint8Array(32))));
}

export function parseArgusSeedUsdc(raw?: number | string | null) {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : Number.NaN;
  const seed = Number.isFinite(parsed) ? Math.floor(parsed) : ARGUS_DEFAULT_SEED_USDC;
  if (seed < ARGUS_MIN_SEED_USDC) {
    throw new Error(`Arc launches need at least ${ARGUS_MIN_SEED_USDC} USDC of seed liquidity so the pool does not open at $0.`);
  }
  if (seed > ARGUS_MAX_SEED_USDC) {
    throw new Error(`Seed liquidity is capped at ${ARGUS_MAX_SEED_USDC} USDC for now.`);
  }
  return {
    ui: seed,
    usdc6: parseUnits(String(seed), 6),
    native: parseUnits(String(seed), 18),
  };
}

async function approveUsdc(pub: PublicClient, wallet: WalletClient, owner: Address, amount: bigint) {
  const current = await pub.readContract({
    address: ARC_USDC, abi: ERC20_ABI, functionName: "allowance", args: [owner, ARGUS_PORTAL7],
  }).catch(() => 0n);
  if (current >= amount) return;
  const hash = await wallet.writeContract({
    account: owner, chain: undefined, address: ARC_USDC, abi: ERC20_ABI, functionName: "approve",
    args: [ARGUS_PORTAL7, maxUint256],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("USDC approval for the Argus portal failed.");
}

async function requireSeedFunds(pub: PublicClient, owner: Address, seed: ReturnType<typeof parseArgusSeedUsdc>) {
  const [native, erc20] = await Promise.all([
    pub.getBalance({ address: owner }),
    pub.readContract({ address: ARC_USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] }).catch(() => 0n),
  ]);
  const nativeNeeded = seed.native + ARGUS_GAS_BUFFER_NATIVE;
  if (native < nativeNeeded && erc20 < seed.usdc6) {
    throw new Error(
      `Fund your in-app Arc wallet with at least ${seed.ui + 1} USDC. Argus opens the Uniswap v4 range with $0 in-range liquidity until a USDC buy seeds the pool.`,
    );
  }
  return { native, erc20 };
}

export async function launchWithArgus(input: {
  name: string; symbol: string; logo?: string; twitter?: string; telegram?: string; website?: string;
  blurb?: string; creator: Address; wallet: WalletClient; pub: PublicClient;
  seedUsdc?: number | string | null;
}) {
  const account = input.wallet.account;
  if (!account) throw new Error("Arc wallet account is unavailable.");
  const sender = account.address;
  const seed = parseArgusSeedUsdc(input.seedUsdc);
  const cfg = await readPortalConfig(input.pub);
  await requireSeedFunds(input.pub, sender, seed);
  try { await approveUsdc(input.pub, input.wallet, sender, seed.usdc6); }
  catch (error) {
    console.warn("Argus USDC approve skipped", error instanceof Error ? error.message : error);
  }
  // Live Portal #7 launches with no USDC buy initialize at tickUpper, so StateView
  // liquidity is 0 until the first quote swap. Seed that first buy in the launch tx.
  const params = {
    name: input.name.slice(0, 32), symbol: input.symbol.toUpperCase().slice(0, 10), totalSupply: ARGUS_TOTAL_SUPPLY,
    startFdvUsdc6: ARGUS_START_FDV_USDC6, bondFdvUsdc6: ARGUS_BOND_FDV_USDC6,
    buyTaxBps: 300, sellTaxBps: 300, creatorBps: 10_000, burnBps: 0, dividendBps: 0, liquidityBps: 0,
    devBuyQuote: seed.usdc6, quoteAsset: ARC_USDC, expectConvert: 1,
  } as const;
  const meta = { imageURI: input.logo || "", website: input.website || "", twitter: input.twitter || "", telegram: input.telegram || "", description: (input.blurb || "").slice(0, 280) } as const;

  let salt: Hex = randomSalt();
  let hookSalt: Hex = randomSalt();
  for (let attempt = 0; attempt < 8; attempt++) {
    salt = randomSalt();
    const prepared = prepareArgusLaunch({
      portal: ARGUS_PORTAL7, sender, userSalt: salt,
      tokenImpl: cfg.tokenImpl, splitterImpl: cfg.splitterImpl,
      poolManager: cfg.poolManager, treasury: cfg.treasury, quoteAsset: ARC_USDC,
      buyTaxBps: params.buyTaxBps, sellTaxBps: params.sellTaxBps,
      poolFee: cfg.poolFee, tickSpacing: cfg.tickSpacing,
    });
    hookSalt = prepared.hookSalt;
    const occupied = await input.pub.getCode({ address: prepared.token });
    if (occupied && occupied !== "0x") continue;
    break;
  }

  const simulate = (value: bigint) =>
    input.pub.simulateContract({
      address: ARGUS_PORTAL7, abi: ARGUS_PORTAL7_ABI, functionName: "launch",
      args: [params, meta, salt, hookSalt], account, value,
    });
  let request;
  let lastError: unknown;
  for (const value of [seed.native, 0n]) {
    try {
      ({ request } = await simulate(value));
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!request) {
    throw new Error(`Argus launch simulation failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
  let hash: `0x${string}`;
  try { hash = await input.wallet.writeContract(request); }
  catch (error) { throw new Error(`Argus launch signature/submission failed: ${error instanceof Error ? error.message : String(error)}`); }
  const receipt = await input.pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Argus launch reverted. Transaction: ${hash}`);
  const events = parseEventLogs({ abi: ARGUS_PORTAL7_ABI, logs: receipt.logs, eventName: "TokenCreated" });
  const token = events[0]?.args.token as Address | undefined;
  const poolId = events[0]?.args.poolId as `0x${string}` | undefined;
  if (!token || !poolId) throw new Error("Argus launch confirmed, but TokenCreated data was missing.");
  const launch = await input.pub.readContract({ address: ARGUS_PORTAL7, abi: ARGUS_PORTAL7_ABI, functionName: "launches", args: [token] });
  const liquidity = await input.pub.readContract({
    address: ARC_STATE_VIEW, abi: STATE_VIEW_LIQ_ABI, functionName: "getLiquidity", args: [poolId],
  }).catch(() => 0n);
  return {
    hash, token, poolId, hook: launch[4], locker: launch[3], splitter: launch[5],
    factory: ARGUS_PORTAL7, venue: "argus-v4" as const,
    seedUsdc: seed.ui, seedUsdc6: seed.usdc6.toString(), startFdvUsdc: 2_500, bondFdvUsdc: 45_000,
    supply: ARGUS_TOTAL_SUPPLY.toString(), liquidity: liquidity.toString(),
    explorer: `https://www.arcexplorer.org/tx/${hash}`,
    note: `Argus v4 launch confirmed with ${seed.ui} USDC seed liquidity. Supply: ${formatUnits(params.totalSupply, 18)} tokens; quote: Arc USDC.`,
  };
}
