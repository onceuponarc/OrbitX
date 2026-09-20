import "server-only";

import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createBurnInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMint2Instruction,
  createInitializeTransferFeeConfigInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedInstruction,
  AuthorityType,
  getMintLen,
  ExtensionType,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
} from "@solana/spl-token";
import { protocolKeypair } from "@/lib/solana/keys";
import { solanaConnection } from "@/lib/solana/connection";
import { explorerAddress, explorerTx } from "@/lib/solana/explorer";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import { sendSignedTx, waitForTx } from "@/lib/solana/partial-tx";
import { createFungibleMetadataInstruction, metadataPda } from "@/lib/solana/token-metadata";
import { getJupiterQuote, getJupiterSwapTx, WSOL_MINT } from "@/lib/solana/jupiter";
import { inspectMint } from "@/lib/solana/mint";
import type { CustomLaunchAdapter, AdapterContext, DeployResult, ExecuteResult } from "@/lib/custom-launch/onchain/types";
import { assertAllowedAction, assertFeeSplits, assertTradingFeeBps, protocolDestinationForChain } from "@/lib/custom-launch/onchain/validate";
import { resolvedFeeAllocations } from "@/lib/custom-launch/fees";
import { parseSupply } from "@/lib/custom-launch/token";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { SOLANA } from "@onceupon/config/solana";
import { ORBITX_PROTOCOL } from "@/lib/custom-launch/protocol";
import {
  customLaunchCurveKeypair,
  customLaunchFeeRouterKeypair,
  customLaunchVaultKeypair,
  quoteMintForDraft,
  SOLANA_USDC,
  VAULT_DESTS,
} from "@/lib/custom-launch/onchain/solana-keys";
import {
  addSolanaPoolLiquidity,
  harvestSolanaFees,
  swapSolanaPool,
} from "@/lib/custom-launch/onchain/solana-pool";
import {
  addSolanaPumpSwapLiquidity,
  graduateSolanaPumpSwapFromVault,
  isCustomLaunchPumpSwapPool,
} from "@/lib/custom-launch/onchain/solana-pumpswap";

const DESK_MINT_RENT_LAMPORTS = 25_000_000n;
const CURVE_RENT_LAMPORTS = 8_000_000n;

function solanaNote() {
  return [
    "Solana Custom Launch mints SPL or Token-2022 into a protocol-derived bonding-curve vault.",
    "Neither OrbitX nor the creator deposits quote LP. Buyers fund the curve; real quote starts at 0.",
    "Canonical funded SOL/USDC books are linked at launch. Graduation opens PumpSwap from the vault only.",
    "Remove / withdraw / drain is not available.",
    `Cluster: ${SOLANA.cluster}.`,
  ].join(" ");
}

export function solanaAdapter(): CustomLaunchAdapter {
  return {
    capabilities() {
      return {
        chain: "solana",
        tokenCreate: true,
        poolCreate: true,
        feeRouter: true,
        strategyVaults: true,
        buyback: true,
        burn: true,
        addLiquidity: true,
        holders: true,
        note: solanaNote(),
      };
    },
    async createToken(draft, ctx) {
      return deploySolanaToken(draft, ctx);
    },
    async createPool(draft, ctx) {
      if (!ctx.tokenAddress) throw new Error("Token mint is required before the Custom Launch curve can graduate.");
      if (!ctx.launchId) throw new Error("Launch id is required to graduate the curve vault.");
      return graduateSolanaPumpSwapFromVault(draft, ctx, new PublicKey(ctx.tokenAddress));
    },
    async configureFeeRouter() {},
    async configureStrategy() {},
    async executeStrategy(action, amount, ctx) {
      return executeSolana(action, amount, ctx);
    },
    async getExecutionStatus(txHash) {
      const conn = solanaConnection();
      const status = await conn.getSignatureStatus(txHash, { searchTransactionHistory: true });
      const value = status.value;
      if (!value) return "pending";
      if (value.err) return "failed";
      if (value.confirmationStatus === "confirmed" || value.confirmationStatus === "finalized") return "completed";
      return "pending";
    },
  };
}

export async function deploySolanaToken(draft: CustomLaunchDraft, ctx: AdapterContext): Promise<DeployResult> {
  assertTradingFeeBps(draft.fees.tradingFeeBps);
  assertFeeSplits(resolvedFeeAllocations(draft.mode, draft.fees).map((row) => ({ dest: row.id, bps: row.bps })));

  const payer = await deskSolanaKey(ctx.userId);
  const protocol = protocolKeypair();
  const curve = customLaunchCurveKeypair(ctx.launchId);
  const mint = Keypair.generate();
  const router = customLaunchFeeRouterKeypair(ctx.launchId);
  const conn = solanaConnection();
  const deskSol = BigInt(await conn.getBalance(payer.publicKey, "confirmed").catch(() => 0));
  if (deskSol < DESK_MINT_RENT_LAMPORTS + CURVE_RENT_LAMPORTS) {
    throw new Error(
      `Desk needs about ${Number(DESK_MINT_RENT_LAMPORTS + CURVE_RENT_LAMPORTS) / 1e9} SOL for mint rent and the curve vault (have ${Number(deskSol) / 1e9}). This is not quote liquidity.`,
    );
  }

  const standard = draft.token.standard === "spl" ? "spl" : "token2022";
  const programId = standard === "spl" ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
  const decimals = draft.token.decimals;
  const supply = parseSupply(draft.token.supply) * 10n ** BigInt(decimals);
  const taxBps = draft.fees.tradingFeeBps;
  const withFee = standard === "token2022" && taxBps > 0;
  const token2022Extensions = withFee
    ? [ExtensionType.MetadataPointer, ExtensionType.TransferFeeConfig]
    : standard === "token2022"
      ? [ExtensionType.MetadataPointer]
      : [];
  const mintLen = token2022Extensions.length ? getMintLen(token2022Extensions) : MINT_SIZE;
  const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const curveAta = getAssociatedTokenAddressSync(mint.publicKey, curve.publicKey, false, programId);
  const routerTokenAta = getAssociatedTokenAddressSync(mint.publicKey, router.publicKey, false, programId);

  const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId,
    }),
  );
  if (standard === "token2022") {
    tx.add(
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        protocol.publicKey,
        metadataPda(mint.publicKey),
        TOKEN_2022_PROGRAM_ID,
      ),
    );
  }
  if (withFee) {
    tx.add(
      createInitializeTransferFeeConfigInstruction(
        mint.publicKey,
        protocol.publicKey,
        protocol.publicKey,
        taxBps,
        supply,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
  }
  tx.add(
    createInitializeMint2Instruction(mint.publicKey, decimals, protocol.publicKey, protocol.publicKey, programId),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      curveAta,
      curve.publicKey,
      mint.publicKey,
      programId,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      routerTokenAta,
      router.publicKey,
      mint.publicKey,
      programId,
    ),
    createMintToInstruction(mint.publicKey, curveAta, protocol.publicKey, supply, [], programId),
    createFungibleMetadataInstruction({
      mint: mint.publicKey,
      mintAuthority: protocol.publicKey,
      payer: payer.publicKey,
      updateAuthority: protocol.publicKey,
      name: draft.token.name,
      symbol: draft.token.symbol,
      uri: draft.token.imageUrl || "",
      tokenProgram: programId,
    }),
    createSetAuthorityInstruction(mint.publicKey, protocol.publicKey, AuthorityType.MintTokens, null, [], programId),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: curve.publicKey,
      lamports: Number(CURVE_RENT_LAMPORTS),
    }),
  );

  tx.sign(payer, mint, protocol);
  const signature = await sendSignedTx(tx.serialize().toString("base64"));
  await waitForTx(signature, lastValidBlockHeight);
  void protocolDestinationForChain("solana");

  return {
    tokenAddress: mint.publicKey.toBase58(),
    poolAddress: curve.publicKey.toBase58(),
    routerAddress: router.publicKey.toBase58(),
    hubAddress: protocol.publicKey.toBase58(),
    factoryAddress: programId.toBase58(),
    vaultAddress: curve.publicKey.toBase58(),
    mintProgram: standard,
    txHash: signature,
    explorer: explorerTx(signature),
  };
}

async function executeSolana(action: string, amount: bigint, ctx: AdapterContext): Promise<ExecuteResult> {
  assertAllowedAction(action);
  if (action.includes("remove") && action.includes("liquidity")) {
    throw new Error("Remove liquidity is not a Custom Launch action.");
  }

  if (action === "claim_fees") {
    return harvestSolanaFees(null, ctx);
  }
  if (action === "add_liquidity") {
    if (isCustomLaunchPumpSwapPool(ctx)) return addSolanaPumpSwapLiquidity(amount, ctx);
    return addSolanaPoolLiquidity(amount, ctx);
  }

  if (!ctx.tokenAddress) throw new Error("Missing token mint.");
  const mint = new PublicKey(ctx.tokenAddress);
  const payer = await deskSolanaKey(ctx.userId);
  const protocol = protocolKeypair();
  const conn = solanaConnection();
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const mintMeta = await inspectMint(mint);
  const programId = mintMeta.programId;
  const decimals = mintMeta.decimals;

  if (action === "buyback" || action === "buyback_burn") {
    if (ctx.poolAddress && !isCustomLaunchPumpSwapPool(ctx)) {
      const vault = customLaunchVaultKeypair(ctx.launchId, "buyback");
      return swapSolanaPool({
        ctx,
        quoteIn: true,
        amountIn: amount,
        minOut: ctx.minOut ?? 1n,
        trader: vault,
        destOwner: vault.publicKey,
        burnOut: action === "buyback_burn",
      });
    }
    const quote = ctx.quoteAddress || WSOL_MINT;
    const vault = customLaunchVaultKeypair(ctx.launchId, "buyback");
    const quoteInfo = await getJupiterQuote({
      inputMint: quote,
      outputMint: ctx.tokenAddress,
      amountRaw: amount.toString(),
      slippageBps: 100,
    });
    const swapTx = await getJupiterSwapTx(quoteInfo, vault.publicKey.toBase58());
    const tx = Transaction.from(Buffer.from(swapTx, "base64"));
    tx.partialSign(vault);
    if (action === "buyback_burn") {
      const tokenAta = getAssociatedTokenAddressSync(mint, vault.publicKey, false, programId);
      tx.add(
        createBurnInstruction(tokenAta, mint, vault.publicKey, BigInt(quoteInfo.otherAmountThreshold), [], programId),
      );
    }
    const signature = await sendSignedTx(tx.serialize().toString("base64"));
    await waitForTx(signature);
    return {
      txHash: signature,
      explorer: explorerTx(signature),
      received: quoteInfo.otherAmountThreshold,
      status: "completed",
    };
  }

  if (action === "burn") {
    const vault = customLaunchVaultKeypair(ctx.launchId, "burn");
    const ata = getAssociatedTokenAddressSync(mint, vault.publicKey, false, programId);
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
    tx.add(createBurnInstruction(ata, mint, vault.publicKey, amount, [], programId));
    tx.sign(payer, vault);
    const signature = await sendSignedTx(tx.serialize().toString("base64"));
    await waitForTx(signature);
    return { txHash: signature, explorer: explorerTx(signature), status: "completed" };
  }

  const destAction: Record<string, { vault: string; dest?: string; locked?: boolean }> = {
    charity: { vault: "charity", dest: ctx.charity, locked: true },
    treasury: { vault: "treasury", dest: ctx.treasury, locked: true },
    community: { vault: "community", dest: ctx.community, locked: true },
    creator_claim: { vault: "creator", dest: ctx.creatorAddress },
  };
  if (destAction[action]) {
    const spec = destAction[action];
    if (!spec.dest) throw new Error(`No locked ${action} destination.`);
    if (action !== "creator_claim" && spec.dest === ctx.creatorAddress) {
      throw new Error("Strategy funds cannot be redirected to the creator wallet.");
    }
    const vault = customLaunchVaultKeypair(ctx.launchId, spec.vault);
    const from = getAssociatedTokenAddressSync(mint, vault.publicKey, false, programId);
    const toOwner = new PublicKey(spec.dest);
    const to = getAssociatedTokenAddressSync(mint, toOwner, false, programId);
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, to, toOwner, mint, programId),
      createTransferCheckedInstruction(from, mint, to, vault.publicKey, amount, decimals, [], programId),
    );
    tx.sign(payer, vault);
    const signature = await sendSignedTx(tx.serialize().toString("base64"));
    await waitForTx(signature);
    return { txHash: signature, explorer: explorerTx(signature), status: "completed" };
  }

  if (action === "holders") {
    if (!ctx.recipients?.length) throw new Error("Holder distribution needs verified recipients.");
    const vault = customLaunchVaultKeypair(ctx.launchId, "holders");
    const from = getAssociatedTokenAddressSync(mint, vault.publicKey, false, programId);
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
    for (const row of ctx.recipients) {
      if (row.address === ctx.creatorAddress) throw new Error("Creator cannot be a holder-reward recipient.");
      const owner = new PublicKey(row.address);
      const to = getAssociatedTokenAddressSync(mint, owner, false, programId);
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, to, owner, mint, programId),
        createTransferCheckedInstruction(from, mint, to, vault.publicKey, row.amount, decimals, [], programId),
      );
    }
    tx.sign(payer, vault);
    const signature = await sendSignedTx(tx.serialize().toString("base64"));
    await waitForTx(signature);
    return { txHash: signature, explorer: explorerTx(signature), status: "completed" };
  }

  if (action === "flywheel") {
    return executeSolana("buyback_burn", amount, ctx);
  }

  void explorerAddress;
  void protocol;
  throw new Error(`Unsupported Solana Custom Launch action: ${action}`);
}

export function solanaVaultAddresses(launchId: string) {
  const out: Record<string, string> = {};
  for (const dest of VAULT_DESTS) {
    out[dest] =
      dest === "orbitx"
        ? ORBITX_PROTOCOL.destination
        : customLaunchVaultKeypair(launchId, dest).publicKey.toBase58();
  }
  return out;
}

export { customLaunchVaultKeypair, customLaunchCurveKeypair, quoteMintForDraft as quoteMint, SOLANA_USDC };
export { customLaunchPoolKeypair, customLaunchFeeRouterKeypair } from "@/lib/custom-launch/onchain/solana-keys";
export { customLaunchPumpSwapPool } from "@/lib/custom-launch/onchain/solana-pumpswap";
