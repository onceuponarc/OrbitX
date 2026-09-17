import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createServiceClient } from "@/lib/supabase/service";
import { solanaConnection, explorerTx } from "@/lib/solana/connection";
import { openKeypair, protocolKeypair } from "@/lib/solana/keys";
import { serializePartialTx } from "@/lib/solana/partial-tx";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import {
  chapterFeeBps,
  isChapterCurve,
  quoteChapterBuy,
  quoteChapterSell,
  quoteOutForSell,
  splitBuyFees,
  splitCurveFee,
  takeBps,
  tokensOutForBuy,
  type ChapterState,
} from "@/lib/solana/curve";
import { inspectMint, pushCreateAtaIfMissing, tokenBalance, transferCheckedIx, ataFor } from "@/lib/solana/mint";
import { findQuoteByMint, graduationRaw, rawToUi, uiToRaw, virtualRaw } from "@onceupon/config/quotes";
import { holderClaimShare } from "@/lib/solana/tokenomics";

type StoryRow = {
  id: string;
  slug: string;
  engine: "author" | "onceuponers";
  status: string;
  author_user_id: string;
  author_wallet: string;
  token_address: string;
  vault_address: string | null;
  author_bps: number;
  protocol_bps: number;
  snipe_tax_bps: number;
  created_at: string;
  curve_quote_lamports: string | number;
  curve_token_raw: string | number;
  auto_buy_rewards: boolean;
  reward_vault_lamports: string | number;
  venue: string;
  quote_mint: string | null;
  pair_label: string;
  quote_decimals: number | null;
  virtual_quote_raw: string | number | null;
  graduation_quote_raw: string | number | null;
  supply: string | number | null;
  virtual_base_raw?: string | number | null;
  lp_base_reserved_raw?: string | number | null;
  curve_k?: string | number | null;
};

const STORY_SELECT =
  "id, slug, engine, status, author_user_id, author_wallet, token_address, vault_address, author_bps, protocol_bps, snipe_tax_bps, created_at, curve_quote_lamports, curve_token_raw, auto_buy_rewards, reward_vault_lamports, venue, quote_mint, pair_label, quote_decimals, virtual_quote_raw, graduation_quote_raw, supply, virtual_base_raw, lp_base_reserved_raw, curve_k";
const STORY_SELECT_MIN =
  "id, slug, engine, status, author_user_id, author_wallet, token_address, vault_address, author_bps, protocol_bps, snipe_tax_bps, created_at, curve_quote_lamports, curve_token_raw, auto_buy_rewards, reward_vault_lamports, venue, quote_mint, pair_label, quote_decimals, virtual_quote_raw, graduation_quote_raw, supply";

function asBig(value: string | number | null | undefined, fallback = 0n) {
  if (value == null || value === "") return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

function chapterFromStory(story: StoryRow, graduateTarget: bigint): ChapterState | null {
  const virtualBase = asBig(story.virtual_base_raw);
  if (!isChapterCurve(virtualBase)) return null;
  const virtualQuote = asBig(story.virtual_quote_raw);
  return {
    virtualQuote,
    virtualBase,
    realQuote: asBig(story.curve_quote_lamports),
    realBase: asBig(story.curve_token_raw),
    lpReserved: asBig(story.lp_base_reserved_raw),
    k: asBig(story.curve_k, virtualQuote * virtualBase),
    graduateTarget,
  };
}

async function loadStory(slug: string) {
  const service = createServiceClient();
  const full = await service.from("stories").select(STORY_SELECT).eq("slug", slug).maybeSingle();
  const data =
    full.data ??
    (full.error ? (await service.from("stories").select(STORY_SELECT_MIN).eq("slug", slug).maybeSingle()).data : null);
  if (!data?.token_address) throw new Error("Launch not found.");
  return data as StoryRow;
}

function quoteMeta(story: StoryRow) {
  const listed = findQuoteByMint(story.quote_mint);
  const decimals = Number(story.quote_decimals ?? listed?.decimals ?? 9);
  const virtual =
    story.virtual_quote_raw != null
      ? BigInt(story.virtual_quote_raw)
      : listed
        ? virtualRaw(listed)
        : 30_000_000_000n;
  const graduation =
    story.graduation_quote_raw != null
      ? BigInt(story.graduation_quote_raw)
      : listed
        ? graduationRaw(listed)
        : 2_000_000_000n;
  const symbol = story.pair_label || listed?.symbol || "SOL";
  const maxBuy = listed?.maxBuyUi ?? 50;
  return { decimals, virtual, graduation, symbol, maxBuy, mint: story.quote_mint };
}

async function loadCurve(storyId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("curve_secrets")
    .select("ciphertext")
    .eq("story_id", storyId)
    .maybeSingle();
  if (error || !data?.ciphertext) throw new Error("This launch has no curve.");
  return openKeypair(data.ciphertext);
}

async function ensureStoryAta(payer: PublicKey, owner: PublicKey, mint: PublicKey, tx: Transaction) {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);
  const info = await solanaConnection().getAccountInfo(ata);
  if (!info) {
    tx.add(createAssociatedTokenAccountInstruction(payer, ata, owner, mint, TOKEN_PROGRAM_ID));
  }
  return ata;
}

function snipeBps(story: StoryRow): number {
  const ageMs = Date.now() - new Date(story.created_at).getTime();
  if (ageMs > 15 * 60 * 1000) return 0;
  return Number(story.snipe_tax_bps ?? 0);
}

export async function buyOnCurve(userId: string, slug: string, amountUi: number) {
  const story = await loadStory(slug);
  if (story.venue === "nft") throw new Error("NFTs do not trade on the curve.");
  if (story.status !== "live" && story.status !== "graduated") throw new Error("This launch is not trading.");

  const payer = (await deskSolanaKey(userId)).publicKey;
  const meta = quoteMeta(story);
  const chapter = chapterFromStory(story, meta.graduation);
  if (chapter && story.status === "graduated") {
    throw new Error("This Chapter has graduated. Trade the AMM.");
  }
  if (amountUi <= 0 || amountUi > meta.maxBuy) {
    throw new Error(`Buy size must be between 0 and ${meta.maxBuy} ${meta.symbol}.`);
  }

  const quoteIn = uiToRaw(amountUi, meta.decimals);
  const authorBps = story.engine === "author" ? Number(story.author_bps) : 0;
  let tokensOut: bigint;
  let authorCut: bigint;
  let protocolCut: bigint;
  let toCurve: bigint;
  if (chapter) {
    const snipe = takeBps(quoteIn, snipeBps(story));
    const rest = quoteIn - snipe;
    const curveBps = chapterFeeBps(authorBps, Number(story.protocol_bps));
    const quoted = quoteChapterBuy(chapter, rest, curveBps);
    if (quoted.baseOut <= 0n) throw new Error("Curve would return zero tokens.");
    if (quoted.wouldEatLp) throw new Error("That buy would eat the tokens reserved for the book at graduation.");
    const split = splitCurveFee(quoted.fee, authorBps, Number(story.protocol_bps));
    tokensOut = quoted.baseOut;
    authorCut = story.engine === "author" ? split.author : 0n;
    protocolCut = split.protocol + snipe + (story.engine === "onceuponers" ? split.author : 0n);
    toCurve = quoted.netIn;
  } else {
    const fees = splitBuyFees(quoteIn, authorBps, Number(story.protocol_bps), snipeBps(story));
    const quoteReserve = BigInt(story.curve_quote_lamports);
    const tokenReserve = BigInt(story.curve_token_raw);
    tokensOut = tokensOutForBuy(quoteReserve, tokenReserve, fees.toCurve, meta.virtual);
    if (tokensOut <= 0n) throw new Error("Curve would return zero tokens.");
    authorCut = story.engine === "author" ? fees.author : 0n;
    protocolCut = fees.protocol + fees.snipe;
    toCurve = fees.toCurve;
  }

  const curve = await loadCurve(story.id);
  const protocol = protocolKeypair();
  const mint = new PublicKey(story.token_address);
  const tx = new Transaction();
  const userAta = await ensureStoryAta(payer, payer, mint, tx);
  const curveAta = getAssociatedTokenAddressSync(mint, curve.publicKey, false, TOKEN_PROGRAM_ID);

  const vaultCut = 0n;

  if (!meta.mint) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: curve.publicKey,
        lamports: Number(toCurve + vaultCut),
      }),
    );
    if (authorCut > 0n) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: new PublicKey(story.author_wallet),
          lamports: Number(authorCut),
        }),
      );
    }
    if (protocolCut > 0n) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: protocol.publicKey,
          lamports: Number(protocolCut),
        }),
      );
    }
  } else {
    const quote = await inspectMint(meta.mint);
    const userQuote = ataFor(quote.mint, payer, quote.programId);
    const held = await tokenBalance(userQuote, quote.programId);
    if (held < quoteIn) {
      throw new Error(`Your wallet needs ${amountUi} ${meta.symbol} to buy.`);
    }
    const curveQuote = await pushCreateAtaIfMissing(tx, payer, curve.publicKey, quote.mint, quote.programId);
    if (authorCut > 0n) {
      const authorQuote = await pushCreateAtaIfMissing(
        tx,
        payer,
        new PublicKey(story.author_wallet),
        quote.mint,
        quote.programId,
      );
      tx.add(
        transferCheckedIx({
          source: userQuote,
          mint: quote.mint,
          destination: authorQuote,
          owner: payer,
          amount: authorCut,
          decimals: quote.decimals,
          programId: quote.programId,
        }),
      );
    }
    if (protocolCut > 0n) {
      const protoQuote = await pushCreateAtaIfMissing(tx, payer, protocol.publicKey, quote.mint, quote.programId);
      tx.add(
        transferCheckedIx({
          source: userQuote,
          mint: quote.mint,
          destination: protoQuote,
          owner: payer,
          amount: protocolCut,
          decimals: quote.decimals,
          programId: quote.programId,
        }),
      );
    }
    tx.add(
      transferCheckedIx({
        source: userQuote,
        mint: quote.mint,
        destination: curveQuote,
        owner: payer,
        amount: toCurve + vaultCut,
        decimals: quote.decimals,
        programId: quote.programId,
      }),
    );
  }

  tx.add(createTransferInstruction(curveAta, userAta, curve.publicKey, tokensOut, [], TOKEN_PROGRAM_ID));
  const prepared = await serializePartialTx(tx, payer, [curve]);

  return {
    transaction: prepared.transaction,
    side: "buy" as const,
    amountUi,
    tokensOut: tokensOut.toString(),
    quote: meta.symbol,
  };
}

export async function sellOnCurve(
  userId: string,
  slug: string,
  tokenUi: number,
  decimals: number,
) {
  if (tokenUi <= 0) throw new Error("Sell size must be positive.");
  const story = await loadStory(slug);
  if (story.venue === "nft") throw new Error("NFTs do not trade on the curve.");

  const payer = (await deskSolanaKey(userId)).publicKey;
  const meta = quoteMeta(story);
  const chapter = chapterFromStory(story, meta.graduation);
  if (chapter && story.status === "graduated") {
    throw new Error("This Chapter has graduated. Trade the AMM.");
  }
  const tokensIn = uiToRaw(tokenUi, decimals);
  const authorBps = story.engine === "author" ? Number(story.author_bps) : 0;
  let userGets: bigint;
  let authorCut: bigint;
  let protocolCut: bigint;
  if (chapter) {
    const quoted = quoteChapterSell(chapter, tokensIn, chapterFeeBps(authorBps, Number(story.protocol_bps)));
    if (quoted.vaultDry) throw new Error(`The vault cannot pay that much ${meta.symbol}.`);
    if (quoted.quoteOut <= 0n) throw new Error(`Curve would return zero ${meta.symbol}.`);
    const split = splitCurveFee(quoted.fee, authorBps, Number(story.protocol_bps));
    userGets = quoted.quoteOut;
    authorCut = story.engine === "author" ? split.author : 0n;
    protocolCut = split.protocol + (story.engine === "onceuponers" ? split.author : 0n);
  } else {
    const quoteReserve = BigInt(story.curve_quote_lamports);
    const tokenReserve = BigInt(story.curve_token_raw);
    const quoteOut = quoteOutForSell(quoteReserve, tokenReserve, tokensIn, meta.virtual);
    const fees = splitBuyFees(quoteOut, authorBps, Number(story.protocol_bps), 0);
    userGets = fees.toCurve;
    authorCut = story.engine === "author" ? fees.author : 0n;
    protocolCut = fees.protocol;
    if (userGets <= 0n) throw new Error(`Curve would return zero ${meta.symbol}.`);
  }

  const curve = await loadCurve(story.id);
  const protocol = protocolKeypair();
  const mint = new PublicKey(story.token_address);
  const connection = solanaConnection();
  const userAta = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_PROGRAM_ID);
  const curveAta = getAssociatedTokenAddressSync(mint, curve.publicKey, false, TOKEN_PROGRAM_ID);

  const held = await getAccount(connection, userAta);
  if (held.amount < tokensIn) throw new Error("Not enough tokens.");

  const tx = new Transaction().add(
    createTransferInstruction(userAta, curveAta, payer, tokensIn, [], TOKEN_PROGRAM_ID),
  );

  if (!meta.mint) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: curve.publicKey,
        toPubkey: payer,
        lamports: Number(userGets),
      }),
    );
    if (story.engine === "author" && authorCut > 0n) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: curve.publicKey,
          toPubkey: new PublicKey(story.author_wallet),
          lamports: Number(authorCut),
        }),
      );
    }
    if (protocolCut > 0n) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: curve.publicKey,
          toPubkey: protocol.publicKey,
          lamports: Number(protocolCut),
        }),
      );
    }
  } else {
    const quote = await inspectMint(meta.mint);
    const curveQuote = ataFor(quote.mint, curve.publicKey, quote.programId);
    const userQuote = await pushCreateAtaIfMissing(tx, payer, payer, quote.mint, quote.programId);
    tx.add(
      transferCheckedIx({
        source: curveQuote,
        mint: quote.mint,
        destination: userQuote,
        owner: curve.publicKey,
        amount: userGets,
        decimals: quote.decimals,
        programId: quote.programId,
      }),
    );
    if (story.engine === "author" && authorCut > 0n) {
      const authorQuote = await pushCreateAtaIfMissing(
        tx,
        payer,
        new PublicKey(story.author_wallet),
        quote.mint,
        quote.programId,
      );
      tx.add(
        transferCheckedIx({
          source: curveQuote,
          mint: quote.mint,
          destination: authorQuote,
          owner: curve.publicKey,
          amount: authorCut,
          decimals: quote.decimals,
          programId: quote.programId,
        }),
      );
    }
    if (protocolCut > 0n) {
      const protoQuote = await pushCreateAtaIfMissing(tx, payer, protocol.publicKey, quote.mint, quote.programId);
      tx.add(
        transferCheckedIx({
          source: curveQuote,
          mint: quote.mint,
          destination: protoQuote,
          owner: curve.publicKey,
          amount: protocolCut,
          decimals: quote.decimals,
          programId: quote.programId,
        }),
      );
    }
  }

  const prepared = await serializePartialTx(tx, payer, [curve]);
  return {
    transaction: prepared.transaction,
    side: "sell" as const,
    amountUi: tokenUi,
    quoteOut: rawToUi(userGets, meta.decimals),
    quote: meta.symbol,
  };
}

export async function fundHolderRewards(userId: string, slug: string, amountUi: number) {
  const story = await loadStory(slug);
  if (story.engine !== "onceuponers") {
    throw new Error("Creator-fee launches pay you on every trade. There is no holder pool to fund.");
  }
  if (story.author_user_id !== userId) throw new Error("Only the author can fund holder claims.");
  if (story.status !== "live" && story.status !== "graduated") throw new Error("This launch is not live yet.");
  const meta = quoteMeta(story);
  if (amountUi <= 0 || amountUi > meta.maxBuy * 20) {
    throw new Error(`Deposit must be between 0 and ${meta.maxBuy * 20} ${meta.symbol}.`);
  }
  const amount = uiToRaw(amountUi, meta.decimals);
  if (amount <= 0n) throw new Error("Deposit rounds to zero.");
  const payer = (await deskSolanaKey(userId)).publicKey;
  const curve = await loadCurve(story.id);
  const tx = new Transaction();
  if (!meta.mint) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: curve.publicKey,
        lamports: Number(amount),
      }),
    );
  } else {
    const quote = await inspectMint(meta.mint);
    const userQuote = ataFor(quote.mint, payer, quote.programId);
    const held = await tokenBalance(userQuote, quote.programId);
    if (held < amount) throw new Error(`Your wallet needs ${amountUi} ${meta.symbol} to fund claims.`);
    const curveQuote = await pushCreateAtaIfMissing(tx, payer, curve.publicKey, quote.mint, quote.programId);
    tx.add(
      transferCheckedIx({
        source: userQuote,
        mint: quote.mint,
        destination: curveQuote,
        owner: payer,
        amount,
        decimals: quote.decimals,
        programId: quote.programId,
      }),
    );
  }
  const prepared = await serializePartialTx(tx, payer, []);
  return {
    transaction: prepared.transaction,
    side: "fund" as const,
    amountUi,
    quote: meta.symbol,
  };
}

export async function claimPiece(userId: string, slug: string) {
  const story = await loadStory(slug);
  if (story.engine !== "onceuponers") throw new Error("Creator-fee launches push fees. There is nothing to claim.");
  const reward = BigInt(story.reward_vault_lamports);
  if (reward <= 0n) throw new Error("The author has not funded holder claims yet.");
  const meta = quoteMeta(story);

  const payer = (await deskSolanaKey(userId)).publicKey;
  const curve = await loadCurve(story.id);
  const mint = new PublicKey(story.token_address);
  const connection = solanaConnection();
  const userAta = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_PROGRAM_ID);
  const held = await getAccount(connection, userAta).catch(() => null);
  if (!held || held.amount === 0n) throw new Error("You need to hold the token to claim.");

  const supply = story.supply != null ? BigInt(story.supply) : BigInt(story.curve_token_raw) + held.amount;
  const share = holderClaimShare({
    reward,
    held: held.amount,
    supply,
    curveTokens: BigInt(story.curve_token_raw),
  });
  if (share <= 0n) throw new Error("Your share rounds to zero.");

  const tx = new Transaction();
  if (!meta.mint) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: curve.publicKey,
        toPubkey: payer,
        lamports: Number(share),
      }),
    );
  } else {
    const quote = await inspectMint(meta.mint);
    const curveQuote = ataFor(quote.mint, curve.publicKey, quote.programId);
    const userQuote = await pushCreateAtaIfMissing(tx, payer, payer, quote.mint, quote.programId);
    tx.add(
      transferCheckedIx({
        source: curveQuote,
        mint: quote.mint,
        destination: userQuote,
        owner: curve.publicKey,
        amount: share,
        decimals: quote.decimals,
        programId: quote.programId,
      }),
    );
  }

  const prepared = await serializePartialTx(tx, payer, [curve]);
  return {
    transaction: prepared.transaction,
    side: "claim" as const,
    amountUi: 0,
    amount: rawToUi(share, meta.decimals),
    quote: meta.symbol,
  };
}

export async function confirmCurveTrade(
  userId: string,
  slug: string,
  signature: string,
  side: "buy" | "sell" | "claim" | "fund",
  amountUi: number,
  decimals: number,
  payerAddress?: string,
) {
  const story = await loadStory(slug);
  const meta = quoteMeta(story);
  const service = createServiceClient();
  const trader = payerAddress?.trim() || (await deskSolanaKey(userId)).publicKey.toBase58();

  if (side === "buy") {
    const quoteIn = uiToRaw(amountUi, meta.decimals);
    const authorBps = story.engine === "author" ? Number(story.author_bps) : 0;
    const chapter = chapterFromStory(story, meta.graduation);
    let tokensOut: bigint;
    let nextQuote: bigint;
    let nextTokens: bigint;
    let nextVirtualQuote: string | null = null;
    let nextVirtualBase: string | null = null;
    let vaultAmount = 0n;
    let protocolAmount = 0n;
    if (chapter) {
      const snipe = takeBps(quoteIn, snipeBps(story));
      const rest = quoteIn - snipe;
      const quoted = quoteChapterBuy(chapter, rest, chapterFeeBps(authorBps, Number(story.protocol_bps)));
      const split = splitCurveFee(quoted.fee, authorBps, Number(story.protocol_bps));
      tokensOut = quoted.baseOut;
      nextQuote = quoted.nextRealQuote;
      nextTokens = quoted.remaining;
      nextVirtualQuote = (chapter.virtualQuote + quoted.netIn).toString();
      nextVirtualBase = (chapter.k / (chapter.virtualQuote + quoted.netIn)).toString();
      vaultAmount = story.engine === "onceuponers" ? split.author : 0n;
      protocolAmount = split.protocol + snipe;
    } else {
      const fees = splitBuyFees(quoteIn, authorBps, Number(story.protocol_bps), snipeBps(story));
      const quoteReserve = BigInt(story.curve_quote_lamports);
      const tokenReserve = BigInt(story.curve_token_raw);
      tokensOut = tokensOutForBuy(quoteReserve, tokenReserve, fees.toCurve, meta.virtual);
      nextQuote = quoteReserve + fees.toCurve;
      nextTokens = tokenReserve - tokensOut;
      vaultAmount = story.engine === "onceuponers" ? fees.author : 0n;
      protocolAmount = fees.protocol + fees.snipe;
    }
    const graduated = nextQuote >= meta.graduation;
    const patch: Record<string, unknown> = {
      curve_quote_lamports: nextQuote.toString(),
      curve_token_raw: nextTokens.toString(),
      reward_vault_lamports: BigInt(story.reward_vault_lamports).toString(),
      status: graduated ? "graduated" : story.status,
    };
    if (nextVirtualQuote) patch.virtual_quote_raw = nextVirtualQuote;
    if (nextVirtualBase) patch.virtual_base_raw = nextVirtualBase;
    const updated = await service.from("stories").update(patch).eq("id", story.id);
    if (updated.error && (nextVirtualQuote || nextVirtualBase)) {
      delete patch.virtual_quote_raw;
      delete patch.virtual_base_raw;
      await service.from("stories").update(patch).eq("id", story.id);
    }
    await service.from("trades").insert({
      story_id: story.id,
      tx_hash: signature,
      log_index: 0,
      trader,
      side: "buy",
      token_in: meta.mint ?? "SOL",
      token_out: story.token_address,
      amount_in: quoteIn.toString(),
      amount_out: tokensOut.toString(),
    });
    if (vaultAmount > 0n) {
      await service.from("fee_events").insert({
        story_id: story.id,
        tx_hash: signature,
        log_index: 1,
        block_number: 0,
        swapper: trader,
        asset: meta.mint ?? "SOL",
        author_amount: 0,
        vault_amount: vaultAmount.toString(),
        protocol_amount: protocolAmount.toString(),
      });
    }
    return {
      signature,
      explorer: explorerTx(signature),
      tokensOut: tokensOut.toString(),
      graduated,
      quote: meta.symbol,
    };
  }

  if (side === "sell") {
    const tokensIn = uiToRaw(amountUi, decimals);
    const authorBps = story.engine === "author" ? Number(story.author_bps) : 0;
    const chapter = chapterFromStory(story, meta.graduation);
    let userGets: bigint;
    let nextQuote: bigint;
    let nextTokens: bigint;
    let nextVirtualQuote: string | null = null;
    let nextVirtualBase: string | null = null;
    if (chapter) {
      const quoted = quoteChapterSell(chapter, tokensIn, chapterFeeBps(authorBps, Number(story.protocol_bps)));
      userGets = quoted.quoteOut;
      nextQuote = chapter.realQuote - quoted.gross;
      nextTokens = chapter.realBase + tokensIn;
      const nextBase = chapter.virtualBase + tokensIn;
      nextVirtualBase = nextBase.toString();
      nextVirtualQuote = (chapter.k / nextBase).toString();
    } else {
      const quoteReserve = BigInt(story.curve_quote_lamports);
      const tokenReserve = BigInt(story.curve_token_raw);
      const quoteOut = quoteOutForSell(quoteReserve, tokenReserve, tokensIn, meta.virtual);
      const fees = splitBuyFees(quoteOut, authorBps, Number(story.protocol_bps), 0);
      userGets = fees.toCurve;
      nextQuote = quoteReserve - quoteOut;
      nextTokens = tokenReserve + tokensIn;
    }
    const patch: Record<string, unknown> = {
      curve_quote_lamports: nextQuote.toString(),
      curve_token_raw: nextTokens.toString(),
    };
    if (nextVirtualQuote) patch.virtual_quote_raw = nextVirtualQuote;
    if (nextVirtualBase) patch.virtual_base_raw = nextVirtualBase;
    const updated = await service.from("stories").update(patch).eq("id", story.id);
    if (updated.error && (nextVirtualQuote || nextVirtualBase)) {
      delete patch.virtual_quote_raw;
      delete patch.virtual_base_raw;
      await service.from("stories").update(patch).eq("id", story.id);
    }
    await service.from("trades").insert({
      story_id: story.id,
      tx_hash: signature,
      log_index: 0,
      trader,
      side: "sell",
      token_in: story.token_address,
      token_out: meta.mint ?? "SOL",
      amount_in: tokensIn.toString(),
      amount_out: userGets.toString(),
    });
    return {
      signature,
      explorer: explorerTx(signature),
      quoteOut: rawToUi(userGets, meta.decimals),
      quote: meta.symbol,
    };
  }

  if (side === "fund") {
    const amount = uiToRaw(amountUi, meta.decimals);
    await service
      .from("stories")
      .update({
        reward_vault_lamports: (BigInt(story.reward_vault_lamports) + amount).toString(),
      })
      .eq("id", story.id);
    return {
      signature,
      explorer: explorerTx(signature),
      amount: amountUi,
      quote: meta.symbol,
    };
  }

  const reward = BigInt(story.reward_vault_lamports);
  const mint = new PublicKey(story.token_address);
  const userAta = getAssociatedTokenAddressSync(mint, new PublicKey(trader), false, TOKEN_PROGRAM_ID);
  const held = await getAccount(solanaConnection(), userAta).catch(() => null);
  const supply = story.supply != null ? BigInt(story.supply) : BigInt(story.curve_token_raw) + (held?.amount ?? 0n);
  const share =
    held && held.amount > 0n
      ? holderClaimShare({
          reward,
          held: held.amount,
          supply,
          curveTokens: BigInt(story.curve_token_raw),
        })
      : 0n;
  await service
    .from("stories")
    .update({ reward_vault_lamports: (reward - share).toString() })
    .eq("id", story.id);
  await service.from("piece_claims").insert({
    story_id: story.id,
    user_id: userId,
    wallet: trader,
    tx_hash: signature,
    asset: meta.mint ?? "SOL",
    amount: share.toString(),
  });
  return {
    signature,
    explorer: explorerTx(signature),
    amount: rawToUi(share, meta.decimals),
    quote: meta.symbol,
  };
}
