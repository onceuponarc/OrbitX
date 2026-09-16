import "server-only";

import { formatUnits, parseEventLogs, type Address, type PublicClient, type WalletClient } from "viem";

export const ARGUS_PORTAL7 = "0xB021Be536808f551b31789422Fd28a6c9c6e97Da" as Address;
export const ARGUS_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as Address;
export const ARC_USDC = "0x3600000000000000000000000000000000000000" as Address;

const erc20Abi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const;

export const ARGUS_PORTAL7_ABI = [
  { type: "function", name: "launch", stateMutability: "nonpayable", inputs: [{ name: "p", type: "tuple", components: [
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

export async function launchWithArgus(input: {
  name: string; symbol: string; logo?: string; twitter?: string; telegram?: string; website?: string;
  blurb?: string; creator: Address; wallet: WalletClient; pub: PublicClient;
}) {
  const account = input.wallet.account;
  if (!account) throw new Error("Arc wallet account is unavailable.");
  const salt = `0x${Buffer.from(`${input.creator}:${input.name}:${input.symbol}:${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
  const hookSalt = `0x${Buffer.from(`hook:${input.creator}:${input.name}:${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
  const params = {
    name: input.name.slice(0, 32), symbol: input.symbol.toUpperCase().slice(0, 10), totalSupply: 1_000_000_000n * 10n ** 18n,
    startFdvUsdc6: 10_000n * 10n ** 6n, bondFdvUsdc6: 100_000n * 10n ** 6n,
    buyTaxBps: 300, sellTaxBps: 300, creatorBps: 2_000, burnBps: 0, dividendBps: 0, liquidityBps: 8_000,
    devBuyQuote: 0n, quoteAsset: ARC_USDC, expectConvert: 1,
  } as const;
  const meta = { imageURI: input.logo || "", website: input.website || "", twitter: input.twitter || "", telegram: input.telegram || "", description: (input.blurb || "").slice(0, 280) } as const;
  let request;
  try {
    ({ request } = await input.pub.simulateContract({ address: ARGUS_PORTAL7, abi: ARGUS_PORTAL7_ABI, functionName: "launch", args: [params, meta, salt, hookSalt], account }));
  } catch (error) {
    throw new Error(`Argus launch simulation failed: ${error instanceof Error ? error.message : String(error)}`);
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
  return { hash, token, poolId, hook: launch[4], locker: launch[3], splitter: launch[5], factory: ARGUS_PORTAL7, venue: "argus-v4" as const, explorer: `https://www.arcexplorer.org/tx/${hash}`, note: `Argus v4 launch confirmed. Supply: ${formatUnits(params.totalSupply, 18)} tokens; quote: Arc USDC.` };
}
