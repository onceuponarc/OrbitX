import "server-only";

import { parseEventLogs, type Address, type PublicClient, type WalletClient } from "viem";

export const ARCPAD_CURVE_PAD = "0x24196cd6e534cfce8f480b53e70809b68ea86f29" as Address;
export const ARC_USDC = "0x3600000000000000000000000000000000000000" as Address;

export const ARCPAD_ABI = [
  { type: "function", name: "createToken", stateMutability: "payable", inputs: [
    { name: "name", type: "string" }, { name: "symbol", type: "string" },
    { name: "meta", type: "tuple", components: [
      { name: "imageURI", type: "string" }, { name: "website", type: "string" },
      { name: "twitter", type: "string" }, { name: "telegram", type: "string" },
    ] }, { name: "salt", type: "bytes32" },
  ], outputs: [] },
  { type: "event", name: "TokenCreated", anonymous: false, inputs: [
    { name: "token", type: "address", indexed: true },
    { name: "creator", type: "address", indexed: true },
    { name: "name", type: "string", indexed: false },
    { name: "symbol", type: "string", indexed: false },
    { name: "pool", type: "address", indexed: false },
    { name: "imageURI", type: "string", indexed: false },
    { name: "website", type: "string", indexed: false },
    { name: "twitter", type: "string", indexed: false },
    { name: "telegram", type: "string", indexed: false },
  ] },
] as const;

export async function launchWithArcPad(input: {
  name: string; symbol: string; logo?: string;
  twitter?: string; telegram?: string; website?: string; creator: Address;
  wallet: WalletClient; pub: PublicClient; devBuy?: bigint;
}) {
  const salt = `0x${Buffer.from(`${input.creator}:${input.name}:${input.symbol}:${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
  const value = input.devBuy ?? 0n;
  const meta = {
    imageURI: input.logo || "", website: input.website || "",
    twitter: input.twitter || "", telegram: input.telegram || "",
  };
  const args = [input.name.slice(0, 64), input.symbol.toUpperCase().slice(0, 16), meta, salt] as const;
  let request;
  try {
    ({ request } = await input.pub.simulateContract({
      address: ARCPAD_CURVE_PAD, abi: ARCPAD_ABI, functionName: "createToken",
      args, account: input.wallet.account, value, gas: 3_000_000n,
    }));
  } catch {
    throw new Error("ArcPad could not simulate this launch. Check the Arc wallet balance and try again.");
  }
  let hash: `0x${string}`;
  try {
    hash = await input.wallet.writeContract(request);
  } catch {
    throw new Error("The Arc launch signature was rejected or the transaction could not be submitted.");
  }
  let receipt;
  try {
    receipt = await input.pub.waitForTransactionReceipt({ hash });
  } catch {
    throw new Error(`Arc launch submitted, but confirmation timed out. Check the transaction: ${hash}`);
  }
  if (receipt.status !== "success") throw new Error("ArcPad launch reverted. No token was created.");
  const events = parseEventLogs({ abi: ARCPAD_ABI, logs: receipt.logs, eventName: "TokenCreated" });
  const token = events[0]?.args.token as Address | undefined;
  if (!token) throw new Error("ArcPad launch confirmed, but the token address was not found in the confirmation event.");
  return { hash, token, factory: ARCPAD_CURVE_PAD, router: null, pairTokens: [ARC_USDC], venue: "arcpad" as const, launchFee: value.toString(), explorer: `https://www.arcexplorer.org/tx/${hash}` };
}
