import "server-only";

import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { createServiceClient } from "@/lib/supabase/service";
import { solanaConnection } from "@/lib/solana/connection";
import { protocolKeypair } from "@/lib/solana/keys";
import { explorerTx } from "@/lib/solana/explorer";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import { sendSignedTx, waitForTx } from "@/lib/solana/partial-tx";
import { inspectMint, ataFor } from "@/lib/solana/mint";
import { ORBITX_PROTOCOL } from "@/lib/custom-launch/protocol";
import {
  chapterStateFromRaw,
  quoteCustomLaunchBuy,
  quoteCustomLaunchSell,
  type CustomLaunchCurveRaw,
} from "@/lib/custom-launch/curve";
import { customLaunchCurveKeypair, quoteSpec } from "@/lib/custom-launch/onchain/solana-keys";
import { graduateSolanaPumpSwapFromVault } from "@/lib/custom-launch/onchain/solana-pumpswap";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { uiToRaw } from "@onceupon/config/quotes";
import { PROTOCOL_SHARE_BPS } from "@/lib/custom-launch/onchain/pool-math";

function asBig(value: string | number | null | undefined, fallback = 0n) {
  if (value == null || value === "") return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

function curveRawFromRow(row: {
  virtual_quote_raw?: string | number | null;
  virtual_base_raw?: string | number | null;
  real_quote_raw?: string | number | null;
  real_base_raw?: string | number | null;
  lp_base_reserved_raw?: string | number | null;
  curve_k?: string | number | null;
  graduation_quote_raw?: string | number | null;
  supply?: string | number | null;
}): CustomLaunchCurveRaw {
  const virtualQuoteRaw = asBig(row.virtual_quote_raw);
  const virtualBaseRaw = asBig(row.virtual_base_raw);
  return {
    virtualQuoteRaw,
    virtualBaseRaw,
    realQuoteRaw: asBig(row.real_quote_raw),
    realBaseRaw: asBig(row.real_base_raw, asBig(row.supply)),
    lpReservedRaw: asBig(row.lp_base_reserved_raw),
    k: asBig(row.curve_k, virtualQuoteRaw * virtualBaseRaw),
    graduateTargetRaw: asBig(row.graduation_quote_raw),
    supplyRaw: asBig(row.supply),
    quoteDecimals: 9,
  };
}

export async function tradeCustomLaunchCurve(input: {
  userId: string;
  slug: string;
  side: "buy" | "sell";
  amountUi: number;
}) {
  if (!(input.amountUi > 0)) throw new Error("Trade size must be greater than zero.");
  const service = createServiceClient();
  const { data: launch, error } = await service
    .from("custom_launches")
    .select("*")
    .eq("slug", input.slug)
    .maybeSingle();
  if (error || !launch) throw new Error("Custom Launch not found.");
  if (launch.chain !== "solana") throw new Error("This trade path is Solana Custom Launch only.");
  if (launch.status !== "live" && launch.status !== "paused") {
    throw new Error("This Custom Launch is not trading on the curve.");
  }
  if (launch.curve_status === "graduated") {
    throw new Error("This Custom Launch has graduated. Trade the DEX pool.");
  }
  if (launch.curve_status !== "curve" || !launch.token_address || !launch.vault_address) {
    throw new Error("This Custom Launch has no bonding curve.");
  }

  const draft = launch.config as CustomLaunchDraft;
  const feeBps = Number(launch.trade_fee_bps ?? draft.fees?.tradingFeeBps ?? 0);
  const quoteMint = new PublicKey(
    (launch.quote_address as string | null) ||
      (draft.markets?.primary?.quote === "usdc"
        ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        : "So11111111111111111111111111111111111111112"),
  );
  const quoteInfo = quoteSpec(quoteMint);
  const raw = curveRawFromRow(launch);
  raw.quoteDecimals = quoteInfo.decimals;
  const state = chapterStateFromRaw(raw);
  const payer = await deskSolanaKey(input.userId);
  const curve = customLaunchCurveKeypair(launch.id as string);
  const protocol = protocolKeypair();
  const mint = new PublicKey(launch.token_address as string);
  const mintMeta = await inspectMint(mint);
  const conn = solanaConnection();
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });

  const userToken = getAssociatedTokenAddressSync(mint, payer.publicKey, false, mintMeta.programId);
  const curveToken = ataFor(mint, curve.publicKey, mintMeta.programId);
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      userToken,
      payer.publicKey,
      mint,
      mintMeta.programId,
    ),
  );

  let nextRealQuote = state.realQuote;
  let nextRealBase = state.realBase;
  let crosses = false;
  let baseOut = 0n;
  let quoteOut = 0n;
  let fee = 0n;

  if (input.side === "buy") {
    const quoteIn = uiToRaw(input.amountUi, quoteInfo.decimals);
    const quoted = quoteCustomLaunchBuy(state, quoteIn, feeBps);
    if (quoted.baseOut <= 0n) throw new Error("Curve would return zero tokens.");
    if (quoted.wouldEatLp) throw new Error("That buy would eat the tokens reserved for the book at graduation.");
    fee = quoted.fee;
    const protocolCut = (fee * BigInt(PROTOCOL_SHARE_BPS)) / 10_000n;
    const creatorCut = fee - protocolCut;
    const netIn = quoted.netIn;
    baseOut = quoted.baseOut;
    nextRealQuote = quoted.nextRealQuote;
    nextRealBase = quoted.remaining;
    crosses = quoted.crosses;

    if (quoteInfo.isNative) {
      if (netIn > 0n) {
        tx.add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: curve.publicKey, lamports: Number(netIn) }));
      }
      if (protocolCut > 0n) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: new PublicKey(ORBITX_PROTOCOL.destination),
            lamports: Number(protocolCut),
          }),
        );
      }
      if (creatorCut > 0n && launch.creator_address) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: new PublicKey(launch.creator_address as string),
            lamports: Number(creatorCut),
          }),
        );
      }
    } else {
      const userQuote = ataFor(quoteInfo.mint, payer.publicKey, TOKEN_PROGRAM_ID);
      const curveQuote = ataFor(quoteInfo.mint, curve.publicKey, TOKEN_PROGRAM_ID);
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          curveQuote,
          curve.publicKey,
          quoteInfo.mint,
          TOKEN_PROGRAM_ID,
        ),
        createTransferCheckedInstruction(
          userQuote,
          quoteInfo.mint,
          curveQuote,
          payer.publicKey,
          netIn,
          quoteInfo.decimals,
        ),
      );
      if (protocolCut > 0n) {
        const protocolQuote = ataFor(quoteInfo.mint, protocol.publicKey, TOKEN_PROGRAM_ID);
        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(
            payer.publicKey,
            protocolQuote,
            protocol.publicKey,
            quoteInfo.mint,
            TOKEN_PROGRAM_ID,
          ),
          createTransferCheckedInstruction(
            userQuote,
            quoteInfo.mint,
            protocolQuote,
            payer.publicKey,
            protocolCut,
            quoteInfo.decimals,
          ),
        );
      }
    }
    tx.add(
      createTransferCheckedInstruction(
        curveToken,
        mint,
        userToken,
        curve.publicKey,
        baseOut,
        mintMeta.decimals,
        [],
        mintMeta.programId,
      ),
    );
  } else {
    const baseIn = uiToRaw(input.amountUi, mintMeta.decimals);
    const quoted = quoteCustomLaunchSell(state, baseIn, feeBps);
    if (quoted.quoteOut <= 0n) throw new Error("Curve would return zero quote.");
    if (quoted.vaultDry) throw new Error("The curve vault does not hold enough quote for that sell.");
    fee = quoted.fee;
    quoteOut = quoted.quoteOut;
    nextRealQuote = state.realQuote - quoted.gross;
    nextRealBase = state.realBase + baseIn;
    tx.add(
      createTransferCheckedInstruction(
        userToken,
        mint,
        curveToken,
        payer.publicKey,
        baseIn,
        mintMeta.decimals,
        [],
        mintMeta.programId,
      ),
    );
    if (quoteInfo.isNative) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: curve.publicKey,
          toPubkey: payer.publicKey,
          lamports: Number(quoteOut),
        }),
      );
    } else {
      const userQuote = ataFor(quoteInfo.mint, payer.publicKey, TOKEN_PROGRAM_ID);
      const curveQuote = ataFor(quoteInfo.mint, curve.publicKey, TOKEN_PROGRAM_ID);
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          userQuote,
          payer.publicKey,
          quoteInfo.mint,
          TOKEN_PROGRAM_ID,
        ),
        createTransferCheckedInstruction(
          curveQuote,
          quoteInfo.mint,
          userQuote,
          curve.publicKey,
          quoteOut,
          quoteInfo.decimals,
        ),
      );
    }
  }

  tx.sign(payer, curve);
  const signature = await sendSignedTx(tx.serialize().toString("base64"));
  await waitForTx(signature);

  const graduated = crosses || (state.graduateTarget > 0n && nextRealQuote >= state.graduateTarget);
  await service
    .from("custom_launches")
    .update({
      real_quote_raw: nextRealQuote.toString(),
      real_base_raw: nextRealBase.toString(),
      curve_status: graduated ? "graduated" : "curve",
      status: graduated ? "graduated" : launch.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", launch.id);

  let poolAddress = launch.pool_address as string | null;
  let graduateTx: string | null = null;
  if (graduated && launch.token_address) {
    try {
      const result = await graduateSolanaPumpSwapFromVault(
        draft,
        {
          userId: input.userId,
          creatorAddress: launch.creator_address as string,
          protocolAddress: ORBITX_PROTOCOL.destination,
          launchId: launch.id as string,
          execId: `graduate-${launch.id}`,
          tokenAddress: launch.token_address as string,
          quoteAddress: quoteInfo.mint.toBase58(),
        },
        mint,
      );
      if (result.poolAddress && result.txHash) {
        poolAddress = result.poolAddress;
        graduateTx = result.txHash;
        await service
          .from("custom_launches")
          .update({
            pool_address: result.poolAddress,
            factory_address: result.factoryAddress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", launch.id);
        await service
          .from("custom_launch_markets")
          .update({
            pool_address: result.poolAddress,
            status: "live",
            kind: "graduated",
            dex: "pumpswap",
            quote_liquidity: nextRealQuote.toString(),
          })
          .eq("launch_id", launch.id)
          .eq("role", "primary");
      }
    } catch (err) {
      console.error("Custom Launch PumpSwap graduation deferred", err instanceof Error ? err.message : err);
    }
  }

  return {
    txHash: signature,
    explorer: explorerTx(signature),
    side: input.side,
    baseOut: baseOut.toString(),
    quoteOut: quoteOut.toString(),
    fee: fee.toString(),
    realQuote: nextRealQuote.toString(),
    realBase: nextRealBase.toString(),
    graduated,
    poolAddress,
    graduateTx,
  };
}
