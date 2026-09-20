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
  createAssociatedTokenAccountIdempotentInstruction,
  createBurnInstruction,
  createInitializeMint2Instruction,
  createInitializeTransferFeeConfigInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedInstruction,
  AuthorityType,
  getMint,
  getMintLen,
  ExtensionType,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { protocolKeypair } from "@/lib/solana/keys";
import { solanaConnection } from "@/lib/solana/connection";
import { explorerAddress, explorerTx } from "@/lib/solana/explorer";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import { sendSignedTx, waitForTx } from "@/lib/solana/partial-tx";
import { createMetadataV3Instruction } from "@/lib/solana/token-metadata";
import { getJupiterQuote, getJupiterSwapTx, WSOL_MINT } from "@/lib/solana/jupiter";
import type { CustomLaunchAdapter, AdapterContext, DeployResult, ExecuteResult } from "@/lib/custom-launch/onchain/types";
import { assertAllowedAction, assertFeeSplits, assertTradingFeeBps, protocolDestinationForChain } from "@/lib/custom-launch/onchain/validate";
import { resolvedFeeAllocations } from "@/lib/custom-launch/fees";
import { parseSupply } from "@/lib/custom-launch/token";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { SOLANA } from "@onceupon/config/solana";
import { ORBITX_PROTOCOL } from "@/lib/custom-launch/protocol";
import { splitArray } from "@/lib/custom-launch/onchain/splits";
import {
  customLaunchFeeRouterKeypair,
  customLaunchPoolKeypair,
  customLaunchVaultKeypair,
  quoteMintForDraft,
  SOLANA_USDC,
  VAULT_DESTS,
} from "@/lib/custom-launch/onchain/solana-keys";
import {
  addSolanaPoolLiquidity,
  harvestSolanaFees,
  preflightSolanaPoolSeed,
  seedSolanaCustomLaunchPool,
  swapSolanaPool,
} from "@/lib/custom-launch/onchain/solana-pool";

function solanaNote() {
  return [
    "Solana Custom Launch mints a Token-2022 with protocol-owned strategy vaults and an add-only CPMM.",
    "Pool, fee router, and vaults are protocol-derived keys — the creator desk cannot export them.",
    "Liquidity is add-only. Remove / withdraw / drain is not available.",
    "Trading fees harvest to the locked OrbitX destination and strategy vaults.",
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
      if (!ctx.tokenAddress) throw new Error("Token mint is required before the Custom Launch pool can be seeded.");
      return seedSolanaCustomLaunchPool(draft, ctx, new PublicKey(ctx.tokenAddress));
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
  await preflightSolanaPoolSeed(draft, ctx.userId);

  const payer = await deskSolanaKey(ctx.userId);
  const protocol = protocolKeypair();
  const mint = Keypair.generate();
  const pool = customLaunchPoolKeypair(ctx.launchId);
  const router = customLaunchFeeRouterKeypair(ctx.launchId);
  const conn = solanaConnection();
  const decimals = draft.token.decimals;
  const supply = parseSupply(draft.token.supply) * 10n ** BigInt(decimals);
  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLen = getMintLen(extensions);
  const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const taxBps = draft.fees.tradingFeeBps;
  const creatorAta = getAssociatedTokenAddressSync(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const poolTokenAta = getAssociatedTokenAddressSync(mint.publicKey, pool.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const routerTokenAta = getAssociatedTokenAddressSync(mint.publicKey, router.publicKey, false, TOKEN_2022_PROGRAM_ID);

  const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey,
      protocol.publicKey,
      protocol.publicKey,
      taxBps,
      supply,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMint2Instruction(mint.publicKey, decimals, protocol.publicKey, protocol.publicKey, TOKEN_2022_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      creatorAta,
      payer.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      poolTokenAta,
      pool.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      routerTokenAta,
      router.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  const tokenLiq = parseSupply(draft.markets.primary.pool.tokenAllocation || "0") * 10n ** BigInt(decimals);
  const circulating = supply - tokenLiq;
  if (circulating > 0n) {
    tx.add(createMintToInstruction(mint.publicKey, creatorAta, protocol.publicKey, circulating, [], TOKEN_2022_PROGRAM_ID));
  }
  if (tokenLiq > 0n) {
    tx.add(createMintToInstruction(mint.publicKey, poolTokenAta, protocol.publicKey, tokenLiq, [], TOKEN_2022_PROGRAM_ID));
  }
  tx.add(
    createSetAuthorityInstruction(
      mint.publicKey,
      protocol.publicKey,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
    createMetadataV3Instruction({
      mint: mint.publicKey,
      mintAuthority: protocol.publicKey,
      payer: payer.publicKey,
      updateAuthority: protocol.publicKey,
      name: draft.token.name,
      symbol: draft.token.symbol,
      uri: draft.token.imageUrl || "",
    }),
  );

  tx.sign(payer, mint, protocol);
  const signature = await sendSignedTx(tx.serialize().toString("base64"));
  await waitForTx(signature);
  void lastValidBlockHeight;
  void protocolDestinationForChain("solana");

  const poolResult = await seedSolanaCustomLaunchPool(
    draft,
    {
      ...ctx,
      tokenAddress: mint.publicKey.toBase58(),
      tradeFeeBps: draft.fees.tradingFeeBps,
      splitBps: splitArray(draft),
      quoteAddress: quoteMintForDraft(draft).toBase58(),
    },
    mint.publicKey,
  );

  return {
    tokenAddress: mint.publicKey.toBase58(),
    poolAddress: poolResult.poolAddress,
    routerAddress: poolResult.routerAddress,
    hubAddress: poolResult.hubAddress,
    factoryAddress: null,
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
    return addSolanaPoolLiquidity(amount, ctx);
  }

  if (!ctx.tokenAddress) throw new Error("Missing token mint.");
  const mint = new PublicKey(ctx.tokenAddress);
  const payer = await deskSolanaKey(ctx.userId);
  const protocol = protocolKeypair();
  const conn = solanaConnection();
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const mintAccount = await getMint(conn, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  const decimals = mintAccount.decimals;

  if (action === "buyback" || action === "buyback_burn") {
    if (ctx.poolAddress) {
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
      const tokenAta = getAssociatedTokenAddressSync(mint, vault.publicKey, false, TOKEN_2022_PROGRAM_ID);
      tx.add(
        createBurnInstruction(tokenAta, mint, vault.publicKey, BigInt(quoteInfo.otherAmountThreshold), [], TOKEN_2022_PROGRAM_ID),
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
    const ata = getAssociatedTokenAddressSync(mint, vault.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
    tx.add(createBurnInstruction(ata, mint, vault.publicKey, amount, [], TOKEN_2022_PROGRAM_ID));
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
    const from = getAssociatedTokenAddressSync(mint, vault.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const toOwner = new PublicKey(spec.dest);
    const to = getAssociatedTokenAddressSync(mint, toOwner, false, TOKEN_2022_PROGRAM_ID);
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, to, toOwner, mint, TOKEN_2022_PROGRAM_ID),
      createTransferCheckedInstruction(from, mint, to, vault.publicKey, amount, decimals, [], TOKEN_2022_PROGRAM_ID),
    );
    tx.sign(payer, vault);
    const signature = await sendSignedTx(tx.serialize().toString("base64"));
    await waitForTx(signature);
    return { txHash: signature, explorer: explorerTx(signature), status: "completed" };
  }

  if (action === "holders") {
    if (!ctx.recipients?.length) throw new Error("Holder distribution needs verified recipients.");
    const vault = customLaunchVaultKeypair(ctx.launchId, "holders");
    const from = getAssociatedTokenAddressSync(mint, vault.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
    for (const row of ctx.recipients) {
      if (row.address === ctx.creatorAddress) throw new Error("Creator cannot be a holder-reward recipient.");
      const owner = new PublicKey(row.address);
      const to = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, to, owner, mint, TOKEN_2022_PROGRAM_ID),
        createTransferCheckedInstruction(from, mint, to, vault.publicKey, row.amount, decimals, [], TOKEN_2022_PROGRAM_ID),
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

export { customLaunchVaultKeypair, quoteMintForDraft as quoteMint, SOLANA_USDC };
export { customLaunchPoolKeypair, customLaunchFeeRouterKeypair } from "@/lib/custom-launch/onchain/solana-keys";
