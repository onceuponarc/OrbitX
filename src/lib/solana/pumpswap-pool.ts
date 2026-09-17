import "server-only";

import BN from "bn.js";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { OnlinePumpAmmSdk, PUMP_AMM_SDK, poolPda } from "@pump-fun/pump-swap-sdk";
import { PUMPSWAP } from "@onceupon/config/launchpad";
import { SOLANA } from "@onceupon/config/solana";
import { findQuoteByMint, rawToUi, uiToRaw } from "@onceupon/config/quotes";
import { createServiceClient } from "@/lib/supabase/service";
import { solanaConnection } from "@/lib/solana/connection";
import { openKeypair } from "@/lib/solana/keys";
import { serializePartialTx, waitForTx } from "@/lib/solana/partial-tx";
import { explorerAddress, explorerTx } from "@/lib/solana/explorer";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import {
  inspectMint,
  pushCreateAtaIfMissing,
  tokenBalance,
  transferCheckedIx,
  ataFor,
} from "@/lib/solana/mint";

const POOL_INDEX = 0;
const MIN_SOL_FOR_RENT = 30_000_000n; // ~0.03 SOL for pool account, ATAs, fees
const DEFAULT_BASE_BPS = 8_000; // 80% of remaining curve tokens

type StoryRow = {
  id: string;
  slug: string;
  ticker: string;
  status: string;
  venue: string;
  author_user_id: string;
  token_address: string | null;
  vault_address: string | null;
  quote_mint: string | null;
  pair_label: string;
  quote_decimals: number | null;
  mint_decimals: number | null;
  curve_token_raw: string | number | null;
  curve_quote_lamports: string | number | null;
  graduation_quote_raw: string | number | null;
  supply: string | number | null;
};

function isNativeQuote(mint: PublicKey) {
  return mint.equals(NATIVE_MINT);
}

function clampBps(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_BASE_BPS;
  return Math.min(9_500, Math.max(100, Math.round(value)));
}

async function loadStory(slug: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("stories")
    .select(
      "id, slug, ticker, status, venue, author_user_id, token_address, vault_address, quote_mint, pair_label, quote_decimals, mint_decimals, curve_token_raw, curve_quote_lamports, graduation_quote_raw, supply",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) throw new Error("Launch not found.");
  return data as StoryRow;
}

async function loadCurve(storyId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("curve_secrets")
    .select("ciphertext")
    .eq("story_id", storyId)
    .maybeSingle();
  if (error || !data?.ciphertext) throw new Error("This launch has no curve vault to seed from.");
  return openKeypair(data.ciphertext);
}

function parseMintAddress(value: string | null | undefined, fallback: PublicKey): PublicKey {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (trimmed === "sol" || trimmed.toLowerCase() === "wsol") return NATIVE_MINT;
  if (trimmed === "usdc") return new PublicKey(SOLANA.usdcMint);
  try {
    return new PublicKey(trimmed);
  } catch {
    throw new Error("That quote mint is not a Solana address.");
  }
}

function budgetIxs() {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  ];
}

async function serializePairTx(
  tx: Transaction,
  feePayer: PublicKey,
  extraSigners: Parameters<typeof serializePartialTx>[2],
  recentBlockhash?: string | null,
) {
  try {
    return await serializePartialTx(tx, feePayer, extraSigners, recentBlockhash);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("too large")) {
      throw new Error(
        "PumpSwap create is too large for one signature. Retry — the pad will split seed and create into two sign-and-pay steps.",
      );
    }
    throw error;
  }
}

export async function buildPumpSwapPair(opts: {
  userId: string;
  slug: string;
  payer?: string;
  quoteMint?: string | null;
  quoteUi: number;
  baseBps?: number;
  recentBlockhash?: string | null;
  fromVault?: boolean;
}) {
  const story = await loadStory(opts.slug);
  if (story.author_user_id !== opts.userId) {
    throw new Error("Only the Author can open PumpSwap LP for this Story.");
  }
  if (story.venue === "nft") {
    throw new Error("NFTs do not seed a PumpSwap pool.");
  }
  if (!story.token_address) {
    throw new Error("Mint is not on-chain yet. Finish sign-and-pay print first.");
  }
  if (opts.fromVault) {
    const realQuote = BigInt(story.curve_quote_lamports ?? 0);
    const target = BigInt(story.graduation_quote_raw ?? 0);
    if (story.status !== "graduated" && !(target > 0n && realQuote >= target)) {
      throw new Error("The Chapter has not graduated yet. Buyers feed the book until the target is met.");
    }
  }

  const payer = (await deskSolanaKey(opts.userId)).publicKey;
  const baseMint = new PublicKey(story.token_address);
  const quoteMint = parseMintAddress(opts.quoteMint ?? story.quote_mint, NATIVE_MINT);
  if (quoteMint.equals(baseMint)) {
    throw new Error("Quote mint must be different from this Story’s token.");
  }

  const connection = solanaConnection();
  const [baseMeta, quoteMeta] = await Promise.all([inspectMint(baseMint), inspectMint(quoteMint)]);
  const listed = findQuoteByMint(quoteMint.toBase58());
  const quoteSymbol = listed?.symbol ?? (isNativeQuote(quoteMint) ? "SOL" : "quote");
  const quoteDecimals = quoteMeta.decimals;
  const curve = await loadCurve(story.id);
  const curveAta = ataFor(baseMeta.mint, curve.publicKey, baseMeta.programId);
  const curveBal = await tokenBalance(curveAta, baseMeta.programId);
  if (curveBal <= 0n) {
    throw new Error("The curve vault is empty. There are no tokens left to seed LP.");
  }

  let quoteIn: bigint;
  let fromVaultQuote = 0n;
  if (opts.fromVault) {
    if (isNativeQuote(quoteMint)) {
      const vaultSol = BigInt(await connection.getBalance(curve.publicKey, "confirmed"));
      const keepAlive = 2_000_000n;
      fromVaultQuote = vaultSol > keepAlive ? vaultSol - keepAlive : 0n;
    } else {
      const curveQuoteAta = ataFor(quoteMeta.mint, curve.publicKey, quoteMeta.programId);
      fromVaultQuote = await tokenBalance(curveQuoteAta, quoteMeta.programId);
    }
    quoteIn = fromVaultQuote;
    if (quoteIn <= 0n) {
      throw new Error(`The vault has no ${quoteSymbol} to open the book. Buyers feed the Chapter until graduation.`);
    }
  } else {
    if (!(opts.quoteUi > 0)) {
      throw new Error(`Deposit more than zero ${quoteSymbol}.`);
    }
    quoteIn = isNativeQuote(quoteMint) ? uiToRaw(opts.quoteUi, 9) : uiToRaw(opts.quoteUi, quoteDecimals);
    if (quoteIn <= 0n) throw new Error(`Deposit more than zero ${quoteSymbol}.`);
  }

  const userBaseAta = ataFor(baseMeta.mint, payer, baseMeta.programId);
  const userBaseBal = await tokenBalance(userBaseAta, baseMeta.programId);
  const bps = opts.fromVault ? 10_000 : clampBps(opts.baseBps ?? DEFAULT_BASE_BPS);
  const targetBase = opts.fromVault ? curveBal : (curveBal * BigInt(bps)) / 10_000n;
  if (targetBase <= 0n) throw new Error("That share of the curve rounds to zero tokens.");
  const fromCurve = userBaseBal >= targetBase ? 0n : targetBase - userBaseBal;
  if (fromCurve > curveBal) {
    throw new Error("The curve vault does not hold that many tokens.");
  }
  const baseIn = opts.fromVault ? fromCurve + userBaseBal : userBaseBal + fromCurve;
  if (baseIn <= 0n) throw new Error("Need a positive token deposit to open the pool.");

  const pool = poolPda(POOL_INDEX, payer, baseMint, quoteMint);
  const existing = await connection.getAccountInfo(pool, "confirmed");
  if (existing) {
    return {
      already: true as const,
      transactions: [] as string[],
      pool: pool.toBase58(),
      mint: baseMint.toBase58(),
      quoteMint: quoteMint.toBase58(),
      quoteSymbol,
      index: POOL_INDEX,
      baseIn: baseIn.toString(),
      quoteIn: quoteIn.toString(),
      fromCurve: "0",
      explorer: explorerAddress(pool.toBase58()),
      proofUrl: `https://dexscreener.com/solana/${pool.toBase58()}`,
    };
  }

  const sol = BigInt(await connection.getBalance(payer, "confirmed"));
  const rentNeed = MIN_SOL_FOR_RENT + (isNativeQuote(quoteMint) && !opts.fromVault ? quoteIn : 0n);
  if (sol < rentNeed) {
    const needUi = Number(rentNeed) / 1e9;
    throw new Error(
      `Your wallet needs at least ${needUi.toFixed(3)} SOL for PumpSwap rent and fees${
        isNativeQuote(quoteMint) && !opts.fromVault ? `, and the ${quoteSymbol} deposit` : ""
      }.`,
    );
  }

  if (!opts.fromVault && !isNativeQuote(quoteMint)) {
    const userQuoteAta = ataFor(quoteMeta.mint, payer, quoteMeta.programId);
    const quoteBal = await tokenBalance(userQuoteAta, quoteMeta.programId);
    if (quoteBal < quoteIn) {
      const have = rawToUi(quoteBal, quoteDecimals);
      throw new Error(
        `Your wallet holds ${have} ${quoteSymbol}. Deposit ${opts.quoteUi} ${quoteSymbol} into this wallet, then sign again.`,
      );
    }
  }

  const seedBody = new Transaction();
  if (fromCurve > 0n) {
    await pushCreateAtaIfMissing(seedBody, payer, payer, baseMeta.mint, baseMeta.programId);
    seedBody.add(
      transferCheckedIx({
        source: curveAta,
        mint: baseMeta.mint,
        destination: userBaseAta,
        owner: curve.publicKey,
        amount: fromCurve,
        decimals: baseMeta.decimals,
        programId: baseMeta.programId,
      }),
    );
  }
  if (opts.fromVault && fromVaultQuote > 0n) {
    if (isNativeQuote(quoteMint)) {
      seedBody.add(
        SystemProgram.transfer({
          fromPubkey: curve.publicKey,
          toPubkey: payer,
          lamports: Number(fromVaultQuote),
        }),
      );
    } else {
      const curveQuoteAta = ataFor(quoteMeta.mint, curve.publicKey, quoteMeta.programId);
      await pushCreateAtaIfMissing(seedBody, payer, payer, quoteMeta.mint, quoteMeta.programId);
      const userQuoteAta = ataFor(quoteMeta.mint, payer, quoteMeta.programId);
      seedBody.add(
        transferCheckedIx({
          source: curveQuoteAta,
          mint: quoteMeta.mint,
          destination: userQuoteAta,
          owner: curve.publicKey,
          amount: fromVaultQuote,
          decimals: quoteMeta.decimals,
          programId: quoteMeta.programId,
        }),
      );
    }
  }

  const sdk = new OnlinePumpAmmSdk(connection);
  const state = await sdk.createPoolSolanaState(POOL_INDEX, payer, baseMint, quoteMint);
  const poolIxs = await PUMP_AMM_SDK.createPoolInstructions(
    state,
    new BN(baseIn.toString()),
    new BN(quoteIn.toString()),
  );

  const transactions: string[] = [];
  const createTx = new Transaction().add(...budgetIxs(), ...poolIxs);

  if (seedBody.instructions.length) {
    const combined = new Transaction().add(...budgetIxs(), ...seedBody.instructions, ...poolIxs);
    try {
      const packed = await serializePartialTx(combined, payer, [curve], opts.recentBlockhash);
      transactions.push(packed.transaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("too large")) throw error;
      const seed = await serializePairTx(
        new Transaction().add(...budgetIxs(), ...seedBody.instructions),
        payer,
        [curve],
        opts.recentBlockhash,
      );
      const created = await serializePairTx(createTx, payer, [], opts.recentBlockhash);
      transactions.push(seed.transaction, created.transaction);
    }
  } else {
    const created = await serializePairTx(createTx, payer, [], opts.recentBlockhash);
    transactions.push(created.transaction);
  }

  return {
    already: false as const,
    transactions,
    transaction: transactions[0],
    pool: pool.toBase58(),
    mint: baseMint.toBase58(),
    quoteMint: quoteMint.toBase58(),
    quoteSymbol,
    index: POOL_INDEX,
    baseIn: baseIn.toString(),
    quoteIn: quoteIn.toString(),
    fromCurve: fromCurve.toString(),
    baseUi: rawToUi(baseIn, baseMeta.decimals),
    quoteUi: rawToUi(quoteIn, isNativeQuote(quoteMint) ? 9 : quoteDecimals),
    fromVault: Boolean(opts.fromVault),
    programId: PUMPSWAP.programId,
    explorer: explorerAddress(pool.toBase58()),
    proofUrl: `https://dexscreener.com/solana/${pool.toBase58()}`,
    swapUrl: `${PUMPSWAP.website}/?inputMint=${quoteMint.toBase58()}&outputMint=${baseMint.toBase58()}`,
  };
}

export async function confirmPumpSwapPair(opts: {
  userId: string;
  slug: string;
  signature: string;
  pool: string;
  quoteMint?: string | null;
}) {
  const story = await loadStory(opts.slug);
  if (story.author_user_id !== opts.userId) {
    throw new Error("Only the Author can record this pool.");
  }
  if (!opts.pool) throw new Error("Confirmation needs the PumpSwap pool address.");

  if (opts.signature && opts.signature.length >= 64 && opts.signature !== "existing") {
    await waitForTx(opts.signature);
  }

  let poolKey: PublicKey;
  try {
    poolKey = new PublicKey(opts.pool);
  } catch {
    throw new Error("That pool address is not valid.");
  }

  const info = await solanaConnection().getAccountInfo(poolKey, "confirmed");
  if (!info) {
    throw new Error("That PumpSwap pool is not on-chain yet. Approve the sign-and-pay prompt and wait for it to land.");
  }
  if (info.owner.toBase58() !== PUMPSWAP.programId) {
    throw new Error("That address is not a PumpSwap pool.");
  }

  const quoteMint = parseMintAddress(opts.quoteMint ?? story.quote_mint, NATIVE_MINT);
  const listed = findQuoteByMint(quoteMint.toBase58());
  const quoteSymbol = listed?.symbol ?? (isNativeQuote(quoteMint) ? "SOL" : "quote");
  const label = `$${story.ticker}/${quoteSymbol} · PumpSwap`;
  const proofUrl = `https://dexscreener.com/solana/${poolKey.toBase58()}`;
  const service = createServiceClient();

  if (story.token_address && story.vault_address) {
    try {
      const base = await inspectMint(story.token_address);
      const curve = await loadCurve(story.id);
      const remaining = await tokenBalance(ataFor(base.mint, curve.publicKey, base.programId), base.programId);
      await service
        .from("stories")
        .update({
          curve_token_raw: remaining.toString(),
          curve_quote_lamports: "0",
          status: "graduated",
        })
        .eq("id", story.id);
    } catch (error) {
      console.error("curve reserve refresh failed", error);
    }
  }

  const { error: bindError } = await service.from("bindings").upsert(
    {
      story_id: story.id,
      kind: "pump_fun",
      is_primary: false,
      chain_caip2: SOLANA.caip2,
      pool_address: poolKey.toBase58(),
      quote_address: quoteMint.toBase58(),
      dest_token_mint: story.token_address,
      mechanism: "pumpswap",
      proof_url: proofUrl,
      fee_routing: "jupiter",
      created_tx: opts.signature,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "story_id,chain_caip2,pool_address" },
  );
  if (bindError && bindError.code !== "23505") {
    throw new Error(bindError.message);
  }

  await service
    .from("stories")
    .update({
      linked_pool_address: poolKey.toBase58(),
      linked_pool_dex: "pumpswap",
      linked_pool_label: label,
    })
    .eq("id", story.id);

  return {
    pool: poolKey.toBase58(),
    label,
    signature: opts.signature,
    explorer: explorerTx(opts.signature),
    proofUrl,
  };
}

export async function waitPairTx(signature: string) {
  if (!signature) throw new Error("Missing signature.");
  await waitForTx(signature);
  return { signature, explorer: explorerTx(signature) };
}
