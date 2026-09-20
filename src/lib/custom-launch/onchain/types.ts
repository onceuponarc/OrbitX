import type { PrintableChain } from "@onceupon/config/solana";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import type { ExecuteAction } from "@/lib/custom-launch/onchain/validate";

export type ChainCapability = {
  chain: PrintableChain;
  tokenCreate: boolean;
  poolCreate: boolean;
  feeRouter: boolean;
  strategyVaults: boolean;
  buyback: boolean;
  burn: boolean;
  addLiquidity: boolean;
  holders: boolean;
  note: string;
};

export type DeployResult = {
  tokenAddress: string;
  poolAddress: string | null;
  routerAddress: string | null;
  hubAddress: string | null;
  factoryAddress: string | null;
  txHash: string;
  explorer: string | null;
  vaultAddress?: string | null;
  mintProgram?: string | null;
};

export type ExecuteResult = {
  txHash: string;
  explorer: string | null;
  received?: string;
  status: "completed" | "failed";
};

export type CustomLaunchAdapter = {
  capabilities(): ChainCapability;
  createToken(draft: CustomLaunchDraft, ctx: AdapterContext): Promise<DeployResult>;
  createPool(draft: CustomLaunchDraft, ctx: AdapterContext): Promise<DeployResult>;
  configureFeeRouter(draft: CustomLaunchDraft, ctx: AdapterContext): Promise<void>;
  configureStrategy(draft: CustomLaunchDraft, ctx: AdapterContext): Promise<void>;
  executeStrategy(action: ExecuteAction, amount: bigint, ctx: AdapterContext): Promise<ExecuteResult>;
  getExecutionStatus(txHash: string): Promise<"pending" | "completed" | "failed">;
};

export type AdapterContext = {
  userId: string;
  creatorAddress: string;
  protocolAddress: string;
  launchId: string;
  execId: string;
  factoryAddress?: string;
  hubAddress?: string;
  tokenAddress?: string;
  poolAddress?: string;
  routerAddress?: string;
  quoteAddress?: string;
  charity?: string;
  treasury?: string;
  community?: string;
  minOut?: bigint;
  recipients?: { address: string; amount: bigint }[];
  vaults?: Partial<Record<string, string>>;
  tradeFeeBps?: number;
  splitBps?: number[];
};

export type UnsupportedOperation = {
  supported: false;
  operation: string;
  reason: string;
};
