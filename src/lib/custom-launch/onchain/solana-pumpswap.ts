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
import { parseTokenAmount } from "@/lib/custom-launch/onchain/pool-math";
import { parseSupply } from "@/lib/custom-launch/token";
import type { AdapterContext, DeployResult, ExecuteResult } from "@/lib/custom-launch/onchain/types";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { orbitxPairedAmount } from "@/lib/custom-launch/orbitx-seed";
import {
  customLaunchFeeRouterKeypair,
  customLaunchVaultKeypair,
  quoteMintForDraft,
  quoteSpec,
  SOLANA_WSOL,
} from "@/lib/custom-launch/onchain/solana-keys";

const POOL_INDEX = 0;
const POOL_RENT_LAMPORTS = 40_000_000n;
const DESK_MINT_RENT_LAMPORTS = 25_000_000n;
const MAX_TX_BYTES = 1232;

function requireNoRemove(action: string) {
  if (action.includes("remove") && action.includes("liquidity")) {
    throw new Error("Remove liquidity is not a Custom Launch action.");
  }
}

export function orbitxQuoteSeedUi(quote: "sol" | "usdc"): string {
  const envName = quote === "sol" ? "CUSTOM_LAUNCH_SOL_SEED" : "CUSTOM_LAUNCH_USDC_SEED";
  const raw = process.env[envName]?.trim();
  if (raw && Number(raw) > 0) return raw;
  return orbitxPairedAmount(quote);
}

export function orbitxQuoteSeedRaw(draft: CustomLaunchDraft): bigint {
  const quote = quoteSpec(quoteMintForDraft(draft));
  const ui = orbitxQuoteSeedUi(quote.isUsdc ? "usdc" : "sol");
  const amount = parseTokenAmount(ui, quote.decimals);
  if (amount <= 0n) throw new Error("OrbitX quote seed must be greater than zero.");
  return amount;
}

export function customLaunchPumpSwapPool(tokenMint: PublicKey, quoteMint: PublicKey): PublicKey {
  return poolPda(POOL_INDEX, protocolKeypair().publicKey, tokenMint, quoteMint);
}

export function isCustomLaunchPumpSwapPool(ctx: AdapterContext): boolean {
  if (!ctx.poolAddress || !ctx.tokenAddress) return false;
  const quote = new PublicKey(ctx.quoteAddress || SOLANA_WSOL);
  return customLaunchPumpSwapPool(new PublicKey(ctx.tokenAddress), quote).toBase58() === ctx.poolAddress;
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

export async function preflightOrbitxPumpSwap(draft: CustomLaunchDraft, userId: string) {
  requireNoRemove("add_liquidity");
  const decimals = draft.token.decimals;
  const supply = parseSupply(draft.token.supply) * 10n ** BigInt(decimals);
  const tokenLiq = parseSupply(draft.markets.primary.pool.tokenAllocation || "0") * 10n ** BigInt(decimals);
  if (tokenLiq <= 0n) throw new Error("Solana Custom Launch pool requires a token allocation.");
  if (tokenLiq >= supply) throw new Error("Pool token allocation must be less than total supply.");

  const quote = quoteSpec(quoteMintForDraft(draft));
  const quoteLiq = orbitxQuoteSeedRaw(draft);
  const protocol = protocolKeypair();
  const desk = await deskSolanaKey(userId);

  const deskSol = await nativeLamports(desk.publicKey);
  if (deskSol < DESK_MINT_RENT_LAMPORTS) {
    throw new Error(
      `Desk needs about ${Number(DESK_MINT_RENT_LAMPORTS) / 1e9} SOL for mint rent and fees (have ${Number(deskSol) / 1e9}). OrbitX seeds the quote side — this is not the pool deposit.`,
    );
  }

  const protocolSol = await nativeLamports(protocol.publicKey);
  const rentNeed = POOL_RENT_LAMPORTS + (quote.isNative ? quoteLiq : 0n);
  if (protocolSol < rentNeed) {
    const ui = Number(rentNeed) / 1e9;
    const have = Number(protocolSol) / 1e9;
    throw new Error(
      `OrbitX protocol wallet ${protocol.publicKey.toBase58()} needs at least ${ui.toFixed(3)} SOL to open the PumpSwap book (have ${have.toFixed(3)}). The creator is not charged for quote liquidity.`,
    );
  }

  if (!quote.isNative) {
    const ata = ataFor(quote.mint, protocol.publicKey, TOKEN_PROGRAM_ID);
    const have = await tokenBalance(ata, TOKEN_PROGRAM_ID);
    if (have < quoteLiq) {
      throw new Error(
        `OrbitX protocol wallet needs ${orbitxQuoteSeedUi("usdc")} USDC to open the PumpSwap book (have ${have.toString()} raw). The creator is not charged for quote liquidity.`,
      );
    }
  }
}

export async function seedSolanaPumpSwapPool(
  draft: CustomLaunchDraft,
  ctx: AdapterContext,
  tokenMint: PublicKey,
): Promise<DeployResult> {
  requireNoRemove("add_liquidity");
  const protocol = protocolKeypair();
  const quote = quoteSpec(quoteMintForDraft(draft));
  const quoteIn = orbitxQuoteSeedRaw(draft);
  const conn = solanaConnection();
  const pool = customLaunchPumpSwapPool(tokenMint, quote.mint);
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
      hubAddress: protocol.publicKey.toBase58(),
      factoryAddress: PUMPSWAP.programId,
      txHash: "",
      explorer: explorerAddress(pool.toBase58()),
    };
  }

  const baseMeta = await inspectMint(tokenMint);
  const protocolBaseAta = ataFor(tokenMint, protocol.publicKey, baseMeta.programId);
  const baseIn = await tokenBalance(protocolBaseAta, baseMeta.programId);
  if (baseIn <= 0n) {
    throw new Error("Protocol does not hold the Custom Launch token allocation to open PumpSwap.");
  }

  const sdk = new OnlinePumpAmmSdk(conn);
  const state = await sdk.createPoolSolanaState(POOL_INDEX, protocol.publicKey, tokenMint, quote.mint);
  const poolIxs = await PUMP_AMM_SDK.createPoolInstructions(state, new BN(baseIn.toString()), new BN(quoteIn.toString()));
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: protocol.publicKey, recentBlockhash: blockhash });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), ...poolIxs);
  const signature = await sendPoolTx(tx, [protocol]);

  const landed = await conn.getAccountInfo(pool, "confirmed");
  if (!landed) throw new Error("PumpSwap pool did not land on-chain.");
  if (landed.owner.toBase58() !== PUMPSWAP.programId) {
    throw new Error("PumpSwap pool owner is not the PumpSwap program.");
  }

  return {
    tokenAddress: tokenMint.toBase58(),
    poolAddress: pool.toBase58(),
    routerAddress: router.publicKey.toBase58(),
    hubAddress: protocol.publicKey.toBase58(),
    factoryAddress: PUMPSWAP.programId,
    txHash: signature,
    explorer: explorerTx(signature),
  };
}

export async function addSolanaPumpSwapLiquidity(amountQuote: bigint, ctx: AdapterContext): Promise<ExecuteResult> {
  requireNoRemove("add_liquidity");
  if (!ctx.tokenAddress || !ctx.poolAddress) throw new Error("Missing Solana Custom Launch pool.");
  if (amountQuote <= 0n) throw new Error("Add-liquidity amount must be greater than zero.");
  if (!isCustomLaunchPumpSwapPool(ctx)) {
    throw new Error("Pool address is not the protocol PumpSwap book for this launch.");
  }

  const payer = await deskSolanaKey(ctx.userId);
  const protocol = protocolKeypair();
  const tokenMint = new PublicKey(ctx.tokenAddress);
  const quote = quoteSpec(ctx.quoteAddress || SOLANA_WSOL);
  const pool = new PublicKey(ctx.poolAddress);
  const liquidity = customLaunchVaultKeypair(ctx.launchId, "liquidity");
  const conn = solanaConnection();
  const baseMeta = await inspectMint(tokenMint);

  const sdk = new OnlinePumpAmmSdk(conn);
  const state = await sdk.liquiditySolanaState(pool, protocol.publicKey);
  const preview = PUMP_AMM_SDK.depositQuoteInput(state, new BN(amountQuote.toString()), 1);
  const tokenIn = BigInt(preview.base.toString());
  const quoteIn = BigInt(preview.maxQuote.toString());
  if (tokenIn <= 0n || quoteIn <= 0n || BigInt(preview.lpToken.toString()) <= 0n) {
    throw new Error("PumpSwap add-liquidity preview produced zero LP.");
  }

  const vaultToken = ataFor(tokenMint, liquidity.publicKey, baseMeta.programId);
  const protocolToken = ataFor(tokenMint, protocol.publicKey, baseMeta.programId);
  const haveToken = await tokenBalance(vaultToken, baseMeta.programId);
  if (haveToken < tokenIn) throw new Error("Liquidity vault does not hold enough token to add PumpSwap depth.");

  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const fund = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
  fund.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      protocolToken,
      protocol.publicKey,
      tokenMint,
      baseMeta.programId,
    ),
    createTransferCheckedInstruction(
      vaultToken,
      tokenMint,
      protocolToken,
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
        toPubkey: protocol.publicKey,
        lamports: Number(quoteIn),
      }),
    );
  } else {
    const vaultQuote = ataFor(quote.mint, liquidity.publicKey, TOKEN_PROGRAM_ID);
    const protocolQuote = ataFor(quote.mint, protocol.publicKey, TOKEN_PROGRAM_ID);
    const haveQuote = await tokenBalance(vaultQuote, TOKEN_PROGRAM_ID);
    if (haveQuote < quoteIn) throw new Error("Liquidity vault does not hold enough USDC to add PumpSwap depth.");
    fund.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        protocolQuote,
        protocol.publicKey,
        quote.mint,
        TOKEN_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(vaultQuote, quote.mint, protocolQuote, liquidity.publicKey, quoteIn, quote.decimals),
    );
  }

  await sendPoolTx(fund, [payer, liquidity]);

  const fundedState = await sdk.liquiditySolanaState(pool, protocol.publicKey);
  const fundedPreview = PUMP_AMM_SDK.depositQuoteInput(fundedState, new BN(amountQuote.toString()), 1);
  const depositIxs = await PUMP_AMM_SDK.depositInstructions(
    fundedState,
    fundedPreview.lpToken,
    1,
  );
  const { blockhash: depositHash } = await conn.getLatestBlockhash("confirmed");
  const deposit = new Transaction({ feePayer: protocol.publicKey, recentBlockhash: depositHash });
  deposit.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...depositIxs);
  const signature = await sendPoolTx(deposit, [protocol]);
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
