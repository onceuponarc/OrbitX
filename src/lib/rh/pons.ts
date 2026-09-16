import { type Address, type PublicClient, type WalletClient } from "viem";

export const PONS_FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e" as const;

export const PONS_FACTORY_ABI = [
  { type: "function", name: "launchFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "launchToken", stateMutability: "payable", inputs: [
    { name: "params", type: "tuple", components: [
      { name: "name", type: "string" }, { name: "symbol", type: "string" },
      { name: "logo", type: "string" }, { name: "description", type: "string" },
      { name: "socials", type: "tuple", components: [
        { name: "twitter", type: "string" }, { name: "telegram", type: "string" },
        { name: "discord", type: "string" }, { name: "website", type: "string" }, { name: "farcaster", type: "string" },
      ] }, { name: "creatorFeeRecipient", type: "address" }, { name: "creatorTaxBps", type: "uint16" },
      { name: "buybackEnabled", type: "bool" }, { name: "expectedEconomics", type: "bytes32" }, { name: "salt", type: "bytes32" },
    ] }, { name: "launchConfigId", type: "uint256" }, { name: "pairToken", type: "address" },
  ], outputs: [{ name: "token", type: "address" }, { name: "curve", type: "address" }] },
] as const;

export type PonsLaunchInput = {
  name: string; symbol: string; logo?: string; description: string;
  twitter?: string; telegram?: string; website?: string; creator: Address;
  creatorTaxBps?: number; buybackEnabled?: boolean; wallet: WalletClient; pub: PublicClient;
};

export async function launchWithPons(input: PonsLaunchInput) {
  const fee = await input.pub.readContract({ address: PONS_FACTORY, abi: PONS_FACTORY_ABI, functionName: "launchFee" });
  const salt = `0x${Buffer.from(`${input.creator}:${input.name}:${input.symbol}:${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
  const params = {
    name: input.name.slice(0, 32), symbol: input.symbol.toUpperCase().slice(0, 12), logo: input.logo || "",
    description: input.description, socials: { twitter: input.twitter || "", telegram: input.telegram || "", discord: "", website: input.website || "", farcaster: "" },
    creatorFeeRecipient: input.creator, creatorTaxBps: input.creatorTaxBps ?? 100, buybackEnabled: input.buybackEnabled ?? false,
    expectedEconomics: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, salt,
  } as const;
  const { request, result } = await input.pub.simulateContract({ address: PONS_FACTORY, abi: PONS_FACTORY_ABI, functionName: "launchToken", args: [params, 0n, "0x0000000000000000000000000000000000000000" as Address], account: input.wallet.account, value: fee });
  const hash = await input.wallet.writeContract(request);
  const receipt = await input.pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Pons launch reverted.");
  return { hash, token: result[0] as Address, curve: result[1] as Address, factory: PONS_FACTORY, router: null, pairTokens: [], launchFee: fee.toString(), venue: "pons" as const };
}
