import "server-only";

import BN from "bn.js";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { OnlinePumpAmmSdk, PUMP_AMM_SDK, poolPda } from "@pump-fun/pump-swap-sdk";
import { PUMPSWAP } from "@onceupon/config/launchpad";
import { protocolKeypair } from "@/lib/solana/keys";
import { solanaConnection } from "@/lib/solana/connection";
import { explorerAddress, explorerTx } from "@/lib/solana/explorer";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import { sendSignedTx, waitForTx } from "@/lib/solana/partial-tx";
import { inspectMint, ataFor, tokenBalance } from "@/lib/solana/mint";
import type { AdapterContext, DeployResult, ExecuteResult } from "@/lib/custom-launch/onchain/types";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { createServiceClient } from "@/lib/supabase/service";
import {
  customLaunchCurveKeypair,
  customLaunchFeeRouterKeypair,
  customLaunchVaultKeypair,
  quoteMintForDraft,
  quoteSpec,
  SOLANA_WSOL,
} from "@/lib/custom-launch/onchain/solana-keys";

const POOL_INDEX = 0;
const MAX_TX_BYTES = 1232;

function requireNoRemove(action: string) {
  if (action.includes("remove") && action.includes("liquidity")) {
    throw new Error("Remove liquidity is not a Custom Launch action.");
  }
}

export function customLaunchPumpSwapPool(tokenMint: PublicKey, quoteMint: PublicKey, launchId: string): PublicKey {
  const curve = customLaunchCurveKeypair(launchId);
  return poolPda(POOL_INDEX, curve.publicKey, tokenMint, quoteMint);
}

export function isCustomLaunchPumpSwapPool(ctx: AdapterContext): boolean {
  if (!ctx.poolAddress || !ctx.tokenAddress || !ctx.launchId) return false;
  const quote = new PublicKey(ctx.quoteAddress || SOLANA_WSOL);
  return customLaunchPumpSwapPool(new PublicKey(ctx.tokenAddress), quote, ctx.launchId).toBase58() === ctx.poolAddress;
}

async function nativeLamports(owner: PublicKey): Promise<bigint> {
  return BigInt(await solanaConnection().getBalance(owner, "confirmed").catch(() => 0));
}

async function sendPoolTx(tx: Transaction, signers: Keypair[]): Promise<string> {
  const unique = new Map<string, Keypair>();
  for (const signer of signers) unique.set(signer.publicKey.toBase58(), signer);
  tx.sign(...unique.values());
  const raw = tx.serialize();
  if (raw.length > MAX_TX_BYTES) {
    throw new Error("Custom Launch PumpSwap transaction exceeds the Solana size limit.");
  }
  const signature = await sendSignedTx(raw.toString("base64"));
  await waitForTx(signature);
  return signature;
}

/** Open PumpSwap from the buyer-funded curve vault. Never uses OrbitX or creator quote. */
export async function graduateSolanaPumpSwapFromVault(
  draft: CustomLaunchDraft,
  ctx: AdapterContext,
  tokenMint: PublicKey,
): Promise<DeployResult> {
  requireNoRemove("add_liquidity");
  const curve = customLaunchCurveKeypair(ctx.launchId);
  const quote = quoteSpec(quoteMintForDraft(draft));
  const conn = solanaConnection();
  const pool = customLaunchPumpSwapPool(tokenMint, quote.mint, ctx.launchId);
  const router = customLaunchFeeRouterKeypair(ctx.launchId);
  const existing = await conn.getAccountInfo(pool, "confirmed");
  if (existing) {
    if (existing.owner.toBase58() !== PUMPSWAP.programId) {
      throw new Error("That pool address is not a PumpSwap pool.");
    }
    return {
      tokenAddress: tokenMint.toBase58(),
      poolAddress: pool.toBase58(),
      routerAddress: router.publicKey.toBase58(),
      hubAddress: protocolKeypair().publicKey.toBase58(),
      factoryAddress: PUMPSWAP.programId,
      vaultAddress: curve.publicKey.toBase58(),
      txHash: "",
      explorer: explorerAddress(pool.toBase58()),
    };
  }

  const service = createServiceClient();
  const { data: launch } = await service
    .from("custom_launches")
    .select("real_quote_raw, real_base_raw, lp_base_reserved_raw, graduation_quote_raw, curve_status")
    .eq("id", ctx.launchId)
    .maybeSingle();
  if (!launch) throw new Error("Custom Launch not found.");
  const realQuote = BigInt(launch.real_quote_raw ?? 0);
  const target = BigInt(launch.graduation_quote_raw ?? 0);
  if (launch.curve_status === "graduated" && realQuote < target) {
    throw new Error("This Custom Launch is marked graduated but the vault has no quote to open a book.");
  }
  if (launch.curve_status !== "graduated" && !(target > 0n && realQuote >= target)) {
    throw new Error("The bonding curve has not graduated. Buyers fund the book until the target is met.");
  }
  if (realQuote <= 0n) {
    throw new Error("Curve vault has no buyer quote. OrbitX and the creator do not seed LP.");
  }

  const baseMeta = await inspectMint(tokenMint);
  const curveBaseAta = ataFor(tokenMint, curve.publicKey, baseMeta.programId);
  const baseIn = await tokenBalance(curveBaseAta, baseMeta.programId);
  const lpReserved = BigInt(launch.lp_base_reserved_raw ?? 0);
  if (baseIn <= 0n || (lpReserved > 0n && baseIn < lpReserved)) {
    throw new Error("Curve vault does not hold the reserved tokens for the graduated book.");
  }

  const sdk = new OnlinePumpAmmSdk(conn);
  const state = await sdk.createPoolSolanaState(POOL_INDEX, curve.publicKey, tokenMint, quote.mint);
  const poolIxs = await PUMP_AMM_SDK.createPoolInstructions(state, new BN(baseIn.toString()), new BN(realQuote.toString()));
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: curve.publicKey, recentBlockhash: blockhash });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), ...poolIxs);
  const signature = await sendPoolTx(tx, [curve]);

  const landed = await conn.getAccountInfo(pool, "confirmed");
  if (!landed) throw new Error("PumpSwap pool did not land on-chain.");
  if (landed.owner.toBase58() !== PUMPSWAP.programId) {
    throw new Error("PumpSwap pool owner is not the PumpSwap program.");
  }

  return {
    tokenAddress: tokenMint.toBase58(),
    poolAddress: pool.toBase58(),
    routerAddress: router.publicKey.toBase58(),
    hubAddress: protocolKeypair().publicKey.toBase58(),
    factoryAddress: PUMPSWAP.programId,
    vaultAddress: curve.publicKey.toBase58(),
    txHash: signature,
    explorer: explorerTx(signature),
  };
}

export async function addSolanaPumpSwapLiquidity(amountQuote: bigint, ctx: AdapterContext): Promise<ExecuteResult> {
  requireNoRemove("add_liquidity");
  if (!ctx.tokenAddress || !ctx.poolAddress) throw new Error("Missing Solana Custom Launch pool.");
  if (amountQuote <= 0n) throw new Error("Add-liquidity amount must be greater than zero.");
  if (!isCustomLaunchPumpSwapPool(ctx)) {
    throw new Error("Pool address is not the graduated PumpSwap book for this launch.");
  }

  const payer = await deskSolanaKey(ctx.userId);
  const curve = customLaunchCurveKeypair(ctx.launchId);
  const tokenMint = new PublicKey(ctx.tokenAddress);
  const quote = quoteSpec(ctx.quoteAddress || SOLANA_WSOL);
  const pool = new PublicKey(ctx.poolAddress);
  const liquidity = customLaunchVaultKeypair(ctx.launchId, "liquidity");
  const conn = solanaConnection();
  const baseMeta = await inspectMint(tokenMint);

  const sdk = new OnlinePumpAmmSdk(conn);
  const state = await sdk.liquiditySolanaState(pool, curve.publicKey);
  const preview = PUMP_AMM_SDK.depositQuoteInput(state, new BN(amountQuote.toString()), 1);
  const tokenIn = BigInt(preview.base.toString());
  const quoteIn = BigInt(preview.maxQuote.toString());
  if (tokenIn <= 0n || quoteIn <= 0n || BigInt(preview.lpToken.toString()) <= 0n) {
    throw new Error("PumpSwap add-liquidity preview produced zero LP.");
  }

  const vaultToken = ataFor(tokenMint, liquidity.publicKey, baseMeta.programId);
  const curveToken = ataFor(tokenMint, curve.publicKey, baseMeta.programId);
  const haveToken = await tokenBalance(vaultToken, baseMeta.programId);
  if (haveToken < tokenIn) throw new Error("Liquidity vault does not hold enough token to add PumpSwap depth.");

  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const fund = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
  fund.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      curveToken,
      curve.publicKey,
      tokenMint,
      baseMeta.programId,
    ),
    createTransferCheckedInstruction(
      vaultToken,
      tokenMint,
      curveToken,
      liquidity.publicKey,
      tokenIn,
      baseMeta.decimals,
      [],
      baseMeta.programId,
    ),
  );

  if (quote.isNative) {
    const nativeHave = await nativeLamports(liquidity.publicKey);
    if (nativeHave < quoteIn) throw new Error("Liquidity vault does not hold enough SOL to add PumpSwap depth.");
    fund.add(
      SystemProgram.transfer({
        fromPubkey: liquidity.publicKey,
        toPubkey: curve.publicKey,
        lamports: Number(quoteIn),
      }),
    );
  } else {
    const vaultQuote = ataFor(quote.mint, liquidity.publicKey, TOKEN_PROGRAM_ID);
    const curveQuote = ataFor(quote.mint, curve.publicKey, TOKEN_PROGRAM_ID);
    const haveQuote = await tokenBalance(vaultQuote, TOKEN_PROGRAM_ID);
    if (haveQuote < quoteIn) throw new Error("Liquidity vault does not hold enough USDC to add PumpSwap depth.");
    fund.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        curveQuote,
        curve.publicKey,
        quote.mint,
        TOKEN_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(vaultQuote, quote.mint, curveQuote, liquidity.publicKey, quoteIn, quote.decimals),
    );
  }

  await sendPoolTx(fund, [payer, liquidity]);

  const fundedState = await sdk.liquiditySolanaState(pool, curve.publicKey);
  const fundedPreview = PUMP_AMM_SDK.depositQuoteInput(fundedState, new BN(amountQuote.toString()), 1);
  const depositIxs = await PUMP_AMM_SDK.depositInstructions(fundedState, fundedPreview.lpToken, 1);
  const { blockhash: depositHash } = await conn.getLatestBlockhash("confirmed");
  const deposit = new Transaction({ feePayer: curve.publicKey, recentBlockhash: depositHash });
  deposit.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...depositIxs);
  const signature = await sendPoolTx(deposit, [curve]);
  return {
    txHash: signature,
    explorer: explorerTx(signature),
    received: fundedPreview.lpToken.toString(),
    status: "completed",
  };
}

export function pumpSwapProofUrl(pool: string) {
  return `https://dexscreener.com/solana/${pool}`;
}

export function pumpSwapTradeUrl(baseMint: string, quoteMint: string) {
  return `${PUMPSWAP.website}/?inputMint=${quoteMint}&outputMint=${baseMint}`;
}
