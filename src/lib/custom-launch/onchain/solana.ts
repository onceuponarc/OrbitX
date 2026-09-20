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
import { createHash } from "node:crypto";
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

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const VAULT_DESTS = ["orbitx", "creator", "holders", "liquidity", "buyback", "burn", "charity", "treasury", "community"] as const;

export function customLaunchVaultKeypair(launchId: string, dest: string): Keypair {
  const seed = createHash("sha256")
    .update(process.env.EMBEDDED_WALLET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "orbitx")
    .update(":custom-launch-vault:")
    .update(launchId)
    .update(":")
    .update(dest)
    .digest();
  return Keypair.fromSeed(seed);
}

function quoteMint(draft: CustomLaunchDraft): PublicKey {
  return new PublicKey(draft.markets.primary.quote === "usdc" ? SOLANA_USDC : WSOL_MINT);
}

function solanaNote() {
  return [
    "Solana Custom Launch mints a Token-2022 with protocol-owned strategy vaults.",
    "Transfer-fee withdraw authority is the protocol key, not the creator desk.",
    "A Custom Launch AMM program is not deployed, so pool creation, on-chain fee routing, and add-liquidity are unsupported.",
    "Buyback uses Jupiter only when the buyback vault already holds quote.",
    `Cluster: ${SOLANA.cluster}.`,
  ].join(" ");
}

export function solanaAdapter(): CustomLaunchAdapter {
  return {
    capabilities() {
      return {
        chain: "solana",
        tokenCreate: true,
        poolCreate: false,
        feeRouter: false,
        strategyVaults: true,
        buyback: true,
        burn: true,
        addLiquidity: false,
        holders: true,
        note: solanaNote(),
      };
    },
    async createToken(draft, ctx) {
      return deploySolanaToken(draft, ctx);
    },
    async createPool() {
      throw new Error(
        "Solana Custom Launch has no AMM program. Pool creation is unsupported — this is not a Normal Launch pump.fun print.",
      );
    },
    async configureFeeRouter() {
      throw new Error("Solana Custom Launch fee routing requires a program. Transfer fees accrue to the protocol withdraw authority.");
    },
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
  const mint = Keypair.generate();
  const conn = solanaConnection();
  const decimals = draft.token.decimals;
  const supply = parseSupply(draft.token.supply) * 10n ** BigInt(decimals);
  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLen = getMintLen(extensions);
  const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const taxBps = draft.fees.tradingFeeBps;
  const creatorAta = getAssociatedTokenAddressSync(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);

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
  );

  const vaults: Record<string, PublicKey> = {};
  for (const dest of VAULT_DESTS) {
    const vault = customLaunchVaultKeypair(ctx.launchId, dest);
    const ata = getAssociatedTokenAddressSync(mint.publicKey, vault.publicKey, false, TOKEN_2022_PROGRAM_ID);
    vaults[dest] = ata;
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        ata,
        vault.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
  }

  const tokenLiq = BigInt(draft.markets.primary.pool.tokenAllocation || "0") * 10n ** BigInt(decimals);
  const circulating = supply - tokenLiq;
  if (circulating > 0n) {
    tx.add(createMintToInstruction(mint.publicKey, creatorAta, protocol.publicKey, circulating, [], TOKEN_2022_PROGRAM_ID));
  }
  if (tokenLiq > 0n) {
    tx.add(
      createMintToInstruction(mint.publicKey, vaults.liquidity, protocol.publicKey, tokenLiq, [], TOKEN_2022_PROGRAM_ID),
    );
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

  return {
    tokenAddress: mint.publicKey.toBase58(),
    poolAddress: null,
    routerAddress: protocol.publicKey.toBase58(),
    hubAddress: protocol.publicKey.toBase58(),
    factoryAddress: null,
    txHash: signature,
    explorer: explorerTx(signature),
  };
}

async function executeSolana(action: string, amount: bigint, ctx: AdapterContext): Promise<ExecuteResult> {
  assertAllowedAction(action);
  if (action === "add_liquidity" || action === "claim_fees") {
    throw new Error(
      action === "add_liquidity"
        ? "Solana Custom Launch cannot add protocol-managed liquidity until an add-only program is deployed."
        : "Solana Custom Launch cannot harvest pool fees until a Custom Launch AMM exists. Token-2022 withheld fees stay with the protocol withdraw authority.",
    );
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
    out[dest] = customLaunchVaultKeypair(launchId, dest).publicKey.toBase58();
  }
  return out;
}

export { quoteMint, SOLANA_USDC };
