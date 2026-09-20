import "server-only";

import {
  createPublicClient,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { deskEvmWallet } from "@/lib/wallets/sign-desk";
import { deskRhWallet } from "@/lib/wallets/rh-client";
import { ACTION_TO_ID, DEST_INDEX, ERC20_ABI, FACTORY_ABI, HUB_ABI, ROUTER_ABI } from "@/lib/custom-launch/onchain/abi";
import type { CustomLaunchAdapter, AdapterContext, DeployResult, ExecuteResult } from "@/lib/custom-launch/onchain/types";
import { assertAllowedAction, assertFeeSplits, assertTradingFeeBps, protocolDestinationForChain } from "@/lib/custom-launch/onchain/validate";
import { resolvedFeeAllocations } from "@/lib/custom-launch/fees";
import { parseSupply } from "@/lib/custom-launch/token";
import { ARC_USDC } from "@/lib/arc/argus";
import type { PrintableChain } from "@onceupon/config/solana";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { flywheelActionIds } from "@/lib/custom-launch/onchain/actions";

function factoryAddress(chain: PrintableChain): Address | null {
  const env = chain === "arc" ? process.env.CUSTOM_LAUNCH_FACTORY_ARC : process.env.CUSTOM_LAUNCH_FACTORY_RH;
  const value = env?.trim();
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : null;
}

function explorer(chain: PrintableChain, hash: string) {
  if (chain === "arc") return `https://testnet.arcscan.io/tx/${hash}`;
  return `https://robinhoodchain.blockscout.com/tx/${hash}`;
}

export function splitArray(draft: CustomLaunchDraft) {
  const rows = resolvedFeeAllocations(draft.mode, draft.fees);
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number, number, number];
  for (const row of rows) {
    const key = row.id === "custom" ? "community" : row.id;
    const idx = DEST_INDEX[key as keyof typeof DEST_INDEX];
    if (idx !== undefined) out[idx] += row.bps;
  }
  return out;
}

async function evmClients(chain: "arc" | "robinhood", userId: string) {
  if (chain === "robinhood") {
    const rh = await deskRhWallet(userId);
    return { wallet: rh.wallet, pub: rh.pub, address: rh.address, rpcUrl: rh.wallet.chain.rpcUrls.default.http[0] };
  }
  const { wallet, address, net } = await deskEvmWallet(userId);
  const pub = createPublicClient({ chain: wallet.chain, transport: http(net.rpcUrl) });
  return { wallet, pub, address, rpcUrl: net.rpcUrl };
}

export function evmAdapter(chain: "arc" | "robinhood"): CustomLaunchAdapter {
  return {
    capabilities() {
      const factory = factoryAddress(chain);
      let note = factory
        ? "Custom Launch factory is configured. Liquidity is add-only."
        : `Custom Launch factory is not deployed on ${chain}. Set CUSTOM_LAUNCH_FACTORY_${chain === "arc" ? "ARC" : "RH"}.`;
      if (chain === "robinhood") {
        try {
          protocolDestinationForChain("robinhood");
        } catch (error) {
          return {
            chain,
            tokenCreate: false,
            poolCreate: false,
            feeRouter: false,
            strategyVaults: false,
            buyback: false,
            burn: false,
            addLiquidity: false,
            holders: false,
            note: error instanceof Error ? error.message : "Robinhood protocol destination is not configured.",
          };
        }
      }
      return {
        chain,
        tokenCreate: Boolean(factory),
        poolCreate: Boolean(factory),
        feeRouter: Boolean(factory),
        strategyVaults: Boolean(factory),
        buyback: Boolean(factory),
        burn: Boolean(factory),
        addLiquidity: Boolean(factory),
        holders: Boolean(factory),
        note,
      };
    },
    async createToken(draft, ctx) {
      return deployEvm(chain, draft, ctx);
    },
    async createPool(draft, ctx) {
      if (!ctx.poolAddress) throw new Error("Pool is created in the same Custom Launch transaction as the token.");
      return {
        tokenAddress: ctx.tokenAddress ?? "",
        poolAddress: ctx.poolAddress,
        routerAddress: ctx.routerAddress ?? null,
        hubAddress: ctx.hubAddress ?? null,
        factoryAddress: ctx.factoryAddress ?? null,
        txHash: "",
        explorer: null,
      };
    },
    async configureFeeRouter() {},
    async configureStrategy() {},
    async executeStrategy(action, amount, ctx) {
      return executeEvm(chain, action, amount, ctx);
    },
    async getExecutionStatus(txHash) {
      const rpc =
        chain === "robinhood"
          ? (await import("@onceupon/config/rh")).RH.rpcUrl
          : (await import("@/lib/arc/env")).loadArcNetwork()?.rpcUrl;
      if (!rpc) return "pending";
      const pub = createPublicClient({ transport: http(rpc) });
      const receipt = await pub.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null);
      if (!receipt) return "pending";
      return receipt.status === "success" ? "completed" : "failed";
    },
  };
}

export async function deployEvm(
  chain: "arc" | "robinhood",
  draft: CustomLaunchDraft,
  ctx: AdapterContext,
): Promise<DeployResult> {
  assertTradingFeeBps(draft.fees.tradingFeeBps);
  const splits = resolvedFeeAllocations(draft.mode, draft.fees).map((row) => ({ dest: row.id, bps: row.bps }));
  assertFeeSplits(splits);
  const factory = factoryAddress(chain);
  if (!factory) throw new Error(evmAdapter(chain).capabilities().note);
  const protocol = protocolDestinationForChain(chain) as Address;
  const { wallet, address, pub } = await evmClients(chain, ctx.userId);
  const quote = (draft.markets.primary.quote === "usdc"
    ? (chain === "arc" ? ARC_USDC : ctx.quoteAddress)
    : ctx.quoteAddress) as Address | undefined;
  if (!quote) throw new Error("Custom Launch EVM primary pair must be a configured ERC-20 quote.");
  const decimals = draft.token.decimals;
  const supply = parseSupply(draft.token.supply) * 10n ** BigInt(decimals);
  const tokenLiq = BigInt(draft.markets.primary.pool.tokenAllocation || "0") * 10n ** BigInt(decimals);
  const quoteLiqRaw = draft.markets.primary.pool.pairedAmount || "0";
  const quoteLiq = chain === "arc" ? BigInt(Math.round(Number(quoteLiqRaw) * 1e6)) : BigInt(quoteLiqRaw);
  const { request, result } = await pub.simulateContract({
    address: factory,
    abi: FACTORY_ABI,
    functionName: "createLaunch",
    account: wallet.account,
    args: [
      {
        name: draft.token.name,
        symbol: draft.token.symbol,
        uri: draft.token.imageUrl || "",
        decimals,
        supply,
        quote,
        tradeFeeBps: draft.fees.tradingFeeBps,
        splitBps: splitArray(draft),
        protocol,
        creator: address as Address,
        charity: (ctx.charity as Address) ?? address as Address,
        treasury: (ctx.treasury as Address) ?? address as Address,
        community: (ctx.community as Address) ?? address as Address,
        tokenLiquidity: tokenLiq,
        quoteLiquidity: quoteLiq,
        maxExecution: 0n,
        cooldown: 0,
        flywheel: flywheelActionIds(draft),
      },
    ],
  });
  const hash = await wallet.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Custom Launch transaction reverted.");
  const [, hub, token, pool, router] = result as unknown as [bigint, Address, Address, Address, Address];
  return {
    tokenAddress: token,
    poolAddress: pool,
    routerAddress: router,
    hubAddress: hub,
    factoryAddress: factory,
    txHash: hash,
    explorer: explorer(chain, hash),
  };
}

export async function executeEvm(
  chain: "arc" | "robinhood",
  action: string,
  amount: bigint,
  ctx: AdapterContext,
): Promise<ExecuteResult> {
  assertAllowedAction(action);
  if (!ctx.hubAddress) throw new Error("Missing strategy hub.");
  const { wallet, pub } = await evmClients(chain, ctx.userId);
  if (action === "claim_fees") {
    if (!ctx.routerAddress) throw new Error("Router address required to harvest fees.");
    const hash = await wallet.writeContract({
      address: ctx.routerAddress as Address,
      abi: ROUTER_ABI,
      functionName: "harvestAll",
      chain: wallet.chain,
      account: wallet.account,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Fee harvest reverted.");
    return { txHash: hash, explorer: explorer(chain, hash), status: "completed" };
  }
  const actionId = ACTION_TO_ID[action];
  if (action === "holders") {
    if (!ctx.recipients?.length) throw new Error("Holder distribution needs verified recipients.");
    if (ctx.recipients.some((row) => row.address.toLowerCase() === ctx.creatorAddress.toLowerCase())) {
      throw new Error("Creator cannot be a holder-reward recipient.");
    }
    const hash = await wallet.writeContract({
      address: ctx.hubAddress as Address,
      abi: HUB_ABI,
      functionName: "executeHolders",
      args: [
        keccak256(stringToHex(ctx.execId)),
        ctx.recipients.map((row) => row.address as Address),
        ctx.recipients.map((row) => row.amount),
        false,
      ],
      chain: wallet.chain,
      account: wallet.account,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Holder distribution reverted.");
    return { txHash: hash, explorer: explorer(chain, hash), status: "completed" };
  }
  const hash = await wallet.writeContract({
    address: ctx.hubAddress as Address,
    abi: HUB_ABI,
    functionName: "execute",
    args: [keccak256(stringToHex(ctx.execId)), actionId, amount, ctx.minOut ?? 0n],
    chain: wallet.chain,
    account: wallet.account,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Strategy execution reverted.");
  return { txHash: hash, explorer: explorer(chain, hash), status: "completed" };
}

export async function readHubBalance(rpcUrl: string, hub: Address, dest: number, asset: Address) {
  const pub = createPublicClient({ transport: http(rpcUrl) });
  return pub.readContract({ address: hub, abi: HUB_ABI, functionName: "balances", args: [dest, asset] });
}

export async function readErc20Balance(rpcUrl: string, token: Address, owner: Address) {
  const pub = createPublicClient({ transport: http(rpcUrl) });
  return pub.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] });
}
