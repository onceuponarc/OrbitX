import "server-only";

import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createBurnInstruction,
  createSyncNativeInstruction,
  createTransferCheckedInstruction,
  createWithdrawWithheldTokensFromAccountsInstruction,
  createWithdrawWithheldTokensFromMintInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getTransferFeeAmount,
  getTransferFeeConfig,
} from "@solana/spl-token";
import { protocolKeypair } from "@/lib/solana/keys";
import { solanaConnection } from "@/lib/solana/connection";
import { explorerTx } from "@/lib/solana/explorer";
import { deskSolanaKey } from "@/lib/wallets/sign-desk";
import { sendSignedTx, waitForTx } from "@/lib/solana/partial-tx";
import { protocolDestinationForChain } from "@/lib/custom-launch/onchain/validate";
import { splitArray } from "@/lib/custom-launch/onchain/splits";
import {
  addLiquidityUnits,
  harvestShares,
  parseTokenAmount,
  swapQuoteOut,
  tokenInForQuote,
} from "@/lib/custom-launch/onchain/pool-math";
import type { AdapterContext, DeployResult, ExecuteResult } from "@/lib/custom-launch/onchain/types";
import type { CustomLaunchDraft } from "@/lib/custom-launch/schema";
import { parseSupply } from "@/lib/custom-launch/token";
import {
  customLaunchFeeRouterKeypair,
  customLaunchPoolKeypair,
  customLaunchVaultKeypair,
  quoteMintForDraft,
  quoteSpec,
  SOLANA_WSOL,
  VAULT_DESTS,
} from "@/lib/custom-launch/onchain/solana-keys";

const MAX_TX_BYTES = 1232;

function tokenAta(mint: PublicKey, owner: PublicKey) {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
}

function quoteAta(mint: PublicKey, owner: PublicKey) {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);
}

async function ataAmount(ata: PublicKey, program: PublicKey): Promise<bigint> {
  const conn = solanaConnection();
  try {
    const account = await getAccount(conn, ata, "confirmed", program);
    return account.amount;
  } catch {
    return 0n;
  }
}

async function nativeLamports(owner: PublicKey): Promise<bigint> {
  return BigInt(await solanaConnection().getBalance(owner, "confirmed").catch(() => 0));
}

export async function readSolanaPoolReserves(opts: {
  poolAddress: string;
  tokenAddress: string;
  quoteAddress: string;
}): Promise<{ token: bigint; quote: bigint }> {
  const pool = new PublicKey(opts.poolAddress);
  const token = new PublicKey(opts.tokenAddress);
  const quote = quoteSpec(opts.quoteAddress);
  return {
    token: await ataAmount(tokenAta(token, pool), TOKEN_2022_PROGRAM_ID),
    quote: await ataAmount(quoteAta(quote.mint, pool), TOKEN_PROGRAM_ID),
  };
}

async function sendPoolTx(tx: Transaction, signers: Keypair[]): Promise<string> {
  const unique = new Map<string, Keypair>();
  for (const signer of signers) unique.set(signer.publicKey.toBase58(), signer);
  const keys = [...unique.values()];
  tx.sign(...keys);
  const raw = tx.serialize();
  if (raw.length > MAX_TX_BYTES) {
    throw new Error("Custom Launch pool transaction exceeds the Solana size limit.");
  }
  const signature = await sendSignedTx(raw.toString("base64"));
  await waitForTx(signature);
  return signature;
}

async function freshTx(payer: PublicKey): Promise<Transaction> {
  const { blockhash } = await solanaConnection().getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  return tx;
}

function requireNoRemove(action: string) {
  if (action.includes("remove") && action.includes("liquidity")) {
    throw new Error("Remove liquidity is not a Custom Launch action.");
  }
}

export function solanaPoolAddresses(launchId: string) {
  const pool = customLaunchPoolKeypair(launchId);
  const router = customLaunchFeeRouterKeypair(launchId);
  return {
    poolAddress: pool.publicKey.toBase58(),
    routerAddress: router.publicKey.toBase58(),
  };
}

function protocolOwner(): PublicKey {
  return new PublicKey(protocolDestinationForChain("solana"));
}

function splitBpsFromCtx(draft: CustomLaunchDraft, ctx: AdapterContext): number[] {
  if (ctx.splitBps?.length === 9) return ctx.splitBps;
  return splitArray(draft);
}

export async function seedSolanaCustomLaunchPool(
  draft: CustomLaunchDraft,
  ctx: AdapterContext,
  tokenMint: PublicKey,
): Promise<DeployResult> {
  requireNoRemove("add_liquidity");
  const decimals = draft.token.decimals;
  const supply = parseSupply(draft.token.supply) * 10n ** BigInt(decimals);
  const tokenLiq = parseTokenAmount(draft.markets.primary.pool.tokenAllocation || "0", decimals);
  const quote = quoteSpec(quoteMintForDraft(draft));
  const quoteLiq = parseTokenAmount(draft.markets.primary.pool.pairedAmount || "0", quote.decimals);
  if (tokenLiq <= 0n || quoteLiq <= 0n) {
    throw new Error("Solana Custom Launch pool requires token and quote seed amounts.");
  }
  if (tokenLiq >= supply) throw new Error("Pool token allocation must be less than total supply.");

  const payer = await deskSolanaKey(ctx.userId);
  await assertDeskCanSeedQuote(payer.publicKey, quote.mint, quoteLiq, quote.isNative);

  const pool = customLaunchPoolKeypair(ctx.launchId);
  const router = customLaunchFeeRouterKeypair(ctx.launchId);
  const liquidity = customLaunchVaultKeypair(ctx.launchId, "liquidity");
  const conn = solanaConnection();
  const mintAccount = await getMint(conn, tokenMint, "confirmed", TOKEN_2022_PROGRAM_ID);

  const poolToken = tokenAta(tokenMint, pool.publicKey);
  const poolQuote = quoteAta(quote.mint, pool.publicKey);
  const routerToken = tokenAta(tokenMint, router.publicKey);
  const routerQuote = quoteAta(quote.mint, router.publicKey);
  const liqToken = tokenAta(tokenMint, liquidity.publicKey);
  const protocol = protocolOwner();
  const protocolToken = tokenAta(tokenMint, protocol);
  const protocolQuote = quoteAta(quote.mint, protocol);

  const tx = await freshTx(payer.publicKey);
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      poolToken,
      pool.publicKey,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      routerToken,
      router.publicKey,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      protocolToken,
      protocol,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      poolQuote,
      pool.publicKey,
      quote.mint,
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      routerQuote,
      router.publicKey,
      quote.mint,
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      protocolQuote,
      protocol,
      quote.mint,
      TOKEN_PROGRAM_ID,
    ),
  );

  const existingPoolToken = await ataAmount(poolToken, TOKEN_2022_PROGRAM_ID);
  const existingPoolQuote = await ataAmount(poolQuote, TOKEN_PROGRAM_ID);
  if (existingPoolToken > 0n && existingPoolQuote > 0n) {
    throw new Error("Solana Custom Launch pool is already seeded.");
  }

  const signers = [payer];
  if (existingPoolToken < tokenLiq) {
    const vaultToken = await ataAmount(liqToken, TOKEN_2022_PROGRAM_ID);
    const needed = tokenLiq - existingPoolToken;
    if (vaultToken < needed) {
      throw new Error("Liquidity vault does not hold the configured token seed.");
    }
    tx.add(
      createTransferCheckedInstruction(
        liqToken,
        tokenMint,
        poolToken,
        liquidity.publicKey,
        needed,
        mintAccount.decimals,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    signers.push(liquidity);
  }
  tx.add(...quoteInInstructions(payer, poolQuote, quote.mint, quoteLiq, quote.isNative, quote.decimals));

  const units = addLiquidityUnits({
    tokenIn: tokenLiq,
    quoteIn: quoteLiq,
    reserveToken: 0n,
    reserveQuote: 0n,
    liquidityUnits: 0n,
  });
  if (units === 0n) throw new Error("Pool seed produced zero liquidity units.");

  const signature = await sendPoolTx(tx, signers);
  const reserves = await readSolanaPoolReserves({
    poolAddress: pool.publicKey.toBase58(),
    tokenAddress: tokenMint.toBase58(),
    quoteAddress: quote.mint.toBase58(),
  });
  if (reserves.token <= 0n || reserves.quote <= 0n) {
    throw new Error("Pool seed did not land token and quote reserves on-chain.");
  }

  return {
    tokenAddress: tokenMint.toBase58(),
    poolAddress: pool.publicKey.toBase58(),
    routerAddress: router.publicKey.toBase58(),
    hubAddress: protocolKeypair().publicKey.toBase58(),
    factoryAddress: null,
    txHash: signature,
    explorer: explorerTx(signature),
  };
}

export async function preflightSolanaPoolSeed(draft: CustomLaunchDraft, userId: string) {
  const decimals = draft.token.decimals;
  const supply = parseSupply(draft.token.supply) * 10n ** BigInt(decimals);
  const tokenLiq = parseTokenAmount(draft.markets.primary.pool.tokenAllocation || "0", decimals);
  const quote = quoteSpec(quoteMintForDraft(draft));
  const quoteLiq = parseTokenAmount(draft.markets.primary.pool.pairedAmount || "0", quote.decimals);
  if (tokenLiq <= 0n || quoteLiq <= 0n) {
    throw new Error("Solana Custom Launch pool requires token and quote seed amounts.");
  }
  if (tokenLiq >= supply) throw new Error("Pool token allocation must be less than total supply.");
  const payer = await deskSolanaKey(userId);
  await assertDeskCanSeedQuote(payer.publicKey, quote.mint, quoteLiq, quote.isNative);
}

async function assertDeskCanSeedQuote(owner: PublicKey, mint: PublicKey, amount: bigint, isNative: boolean) {
  const conn = solanaConnection();
  if (isNative) {
    const rent = BigInt(await conn.getMinimumBalanceForRentExemption(165));
    const need = amount + rent * 4n + 20_000_000n;
    const have = await nativeLamports(owner);
    if (have < need) {
      throw new Error(
        `Desk needs at least ${Number(need) / 1e9} SOL to seed the Custom Launch pool (have ${Number(have) / 1e9}).`,
      );
    }
    return;
  }
  const ata = quoteAta(mint, owner);
  const have = await ataAmount(ata, TOKEN_PROGRAM_ID);
  if (have < amount) {
    throw new Error(`Desk USDC balance ${have.toString()} is below the pool seed ${amount.toString()}.`);
  }
  const rent = BigInt(await conn.getMinimumBalanceForRentExemption(165));
  const solHave = await nativeLamports(owner);
  const solNeed = rent * 6n + 20_000_000n;
  if (solHave < solNeed) {
    throw new Error(
      `Desk needs SOL for pool account rent and fees (have ${Number(solHave) / 1e9}, need about ${Number(solNeed) / 1e9}).`,
    );
  }
}

function quoteInInstructions(
  payer: Keypair,
  destAta: PublicKey,
  mint: PublicKey,
  amount: bigint,
  isNative: boolean,
  decimals: number,
): TransactionInstruction[] {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Quote amount is too large for a Solana transfer.");
  if (isNative) {
    return [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: destAta,
        lamports: Number(amount),
      }),
      createSyncNativeInstruction(destAta),
    ];
  }
  const from = quoteAta(mint, payer.publicKey);
  return [createTransferCheckedInstruction(from, mint, destAta, payer.publicKey, amount, decimals)];
}

export async function addSolanaPoolLiquidity(amountQuote: bigint, ctx: AdapterContext): Promise<ExecuteResult> {
  requireNoRemove("add_liquidity");
  if (!ctx.tokenAddress || !ctx.poolAddress) throw new Error("Missing Solana Custom Launch pool.");
  if (amountQuote <= 0n) throw new Error("Add-liquidity amount must be greater than zero.");
  const payer = await deskSolanaKey(ctx.userId);
  const pool = customLaunchPoolKeypair(ctx.launchId);
  if (pool.publicKey.toBase58() !== ctx.poolAddress) {
    throw new Error("Pool address does not match the protocol-derived Custom Launch pool.");
  }
  const tokenMint = new PublicKey(ctx.tokenAddress);
  const quote = quoteSpec(ctx.quoteAddress || SOLANA_WSOL);
  const reserves = await readSolanaPoolReserves({
    poolAddress: ctx.poolAddress,
    tokenAddress: ctx.tokenAddress,
    quoteAddress: quote.mint.toBase58(),
  });
  const tokenIn = tokenInForQuote(amountQuote, reserves.token, reserves.quote);
  const minUnits = ctx.minOut ?? 1n;
  const units = addLiquidityUnits({
    tokenIn,
    quoteIn: amountQuote,
    reserveToken: reserves.token,
    reserveQuote: reserves.quote,
    liquidityUnits: integerSqrtSafe(reserves.token, reserves.quote),
  });
  if (units < minUnits || units === 0n) throw new Error("Slippage");

  const liquidity = customLaunchVaultKeypair(ctx.launchId, "liquidity");
  const mintAccount = await getMint(solanaConnection(), tokenMint, "confirmed", TOKEN_2022_PROGRAM_ID);
  const liqToken = tokenAta(tokenMint, liquidity.publicKey);
  const liqQuote = quoteAta(quote.mint, liquidity.publicKey);
  const poolToken = tokenAta(tokenMint, pool.publicKey);
  const poolQuote = quoteAta(quote.mint, pool.publicKey);

  const haveToken = await ataAmount(liqToken, TOKEN_2022_PROGRAM_ID);
  if (haveToken < tokenIn) throw new Error("Liquidity vault does not hold enough token to add depth.");

  const tx = await freshTx(payer.publicKey);
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      poolToken,
      pool.publicKey,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      poolQuote,
      pool.publicKey,
      quote.mint,
      TOKEN_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      liqToken,
      tokenMint,
      poolToken,
      liquidity.publicKey,
      tokenIn,
      mintAccount.decimals,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  const signers = [payer, liquidity];
  if (quote.isNative) {
    const wsolHave = await ataAmount(liqQuote, TOKEN_PROGRAM_ID);
    const nativeHave = await nativeLamports(liquidity.publicKey);
    if (wsolHave >= amountQuote) {
      tx.add(
        createTransferCheckedInstruction(liqQuote, quote.mint, poolQuote, liquidity.publicKey, amountQuote, quote.decimals),
      );
    } else if (nativeHave >= amountQuote) {
      if (amountQuote > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Quote amount is too large for a Solana transfer.");
      tx.add(
        SystemProgram.transfer({
          fromPubkey: liquidity.publicKey,
          toPubkey: poolQuote,
          lamports: Number(amountQuote),
        }),
        createSyncNativeInstruction(poolQuote),
      );
    } else {
      throw new Error("Liquidity vault does not hold enough SOL to add depth.");
    }
  } else {
    const haveQuote = await ataAmount(liqQuote, TOKEN_PROGRAM_ID);
    if (haveQuote < amountQuote) throw new Error("Liquidity vault does not hold enough USDC to add depth.");
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        liqQuote,
        liquidity.publicKey,
        quote.mint,
        TOKEN_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(liqQuote, quote.mint, poolQuote, liquidity.publicKey, amountQuote, quote.decimals),
    );
  }

  const signature = await sendPoolTx(tx, signers);
  return { txHash: signature, explorer: explorerTx(signature), received: units.toString(), status: "completed" };
}

function integerSqrtSafe(token: bigint, quote: bigint) {
  if (token === 0n || quote === 0n) return 0n;
  return addLiquidityUnits({ tokenIn: token, quoteIn: quote, reserveToken: 0n, reserveQuote: 0n, liquidityUnits: 0n });
}

export async function harvestSolanaFees(draft: CustomLaunchDraft | null, ctx: AdapterContext): Promise<ExecuteResult> {
  if (!ctx.tokenAddress) throw new Error("Missing token mint.");
  const splits = draft ? splitBpsFromCtx(draft, ctx) : ctx.splitBps;
  if (!splits || splits.length !== 9) throw new Error("Fee splits are required to harvest.");
  const payer = await deskSolanaKey(ctx.userId);
  const protocol = protocolKeypair();
  const router = customLaunchFeeRouterKeypair(ctx.launchId);
  const tokenMint = new PublicKey(ctx.tokenAddress);
  const quote = quoteSpec(ctx.quoteAddress || SOLANA_WSOL);
  const routerToken = tokenAta(tokenMint, router.publicKey);
  const routerQuote = quoteAta(quote.mint, router.publicKey);

  let lastSig: string | null = null;
  const withheld = await harvestWithheldToRouter(payer, protocol, tokenMint, routerToken, ctx);
  if (withheld) lastSig = withheld;

  const quoteBefore = await ataAmount(routerQuote, TOKEN_PROGRAM_ID);
  const tokenBefore = await ataAmount(routerToken, TOKEN_2022_PROGRAM_ID);
  if (quoteBefore === 0n && tokenBefore === 0n && !withheld) {
    throw new Error("No harvestable Custom Launch fees.");
  }

  if (quoteBefore > 0n) {
    lastSig = await splitAssetToVaults({
      payer,
      ctx,
      mint: quote.mint,
      program: TOKEN_PROGRAM_ID,
      decimals: quote.decimals,
      fromAta: routerQuote,
      fromAuthority: router,
      amount: quoteBefore,
      splits,
      isToken2022: false,
    });
  }
  const tokenAfterWithheld = await ataAmount(routerToken, TOKEN_2022_PROGRAM_ID);
  if (tokenAfterWithheld > 0n) {
    const mintAccount = await getMint(solanaConnection(), tokenMint, "confirmed", TOKEN_2022_PROGRAM_ID);
    lastSig = await splitAssetToVaults({
      payer,
      ctx,
      mint: tokenMint,
      program: TOKEN_2022_PROGRAM_ID,
      decimals: mintAccount.decimals,
      fromAta: routerToken,
      fromAuthority: router,
      amount: tokenAfterWithheld,
      splits,
      isToken2022: true,
    });
  }
  if (!lastSig) throw new Error("Fee harvest did not confirm on-chain.");
  return { txHash: lastSig, explorer: explorerTx(lastSig), status: "completed" };
}

async function harvestWithheldToRouter(
  payer: Keypair,
  protocol: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  ctx: AdapterContext,
): Promise<string | null> {
  const conn = solanaConnection();
  const owners: PublicKey[] = [
    customLaunchPoolKeypair(ctx.launchId).publicKey,
    customLaunchFeeRouterKeypair(ctx.launchId).publicKey,
    protocol.publicKey,
    ...VAULT_DESTS.map((dest) =>
      dest === "orbitx" ? protocolOwner() : customLaunchVaultKeypair(ctx.launchId, dest).publicKey,
    ),
  ];
  if (ctx.poolAddress) owners.push(new PublicKey(ctx.poolAddress));
  if (ctx.creatorAddress) owners.push(new PublicKey(ctx.creatorAddress));
  const sources: PublicKey[] = [];
  for (const owner of owners) {
    const ata = tokenAta(mint, owner);
    try {
      const account = await getAccount(conn, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
      const withheld = getTransferFeeAmount(account)?.withheldAmount ?? 0n;
      if (withheld > 0n) sources.push(ata);
    } catch {
      /* account missing */
    }
  }
  let mintWithheld = 0n;
  try {
    const mintAccount = await getMint(conn, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    mintWithheld = getTransferFeeConfig(mintAccount)?.withheldAmount ?? 0n;
  } catch {
    mintWithheld = 0n;
  }
  if (!sources.length && mintWithheld === 0n) return null;

  const tx = await freshTx(payer.publicKey);
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      destination,
      customLaunchFeeRouterKeypair(ctx.launchId).publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
    ),
  );
  for (let i = 0; i < sources.length; i += 5) {
    tx.add(
      createWithdrawWithheldTokensFromAccountsInstruction(
        mint,
        destination,
        protocol.publicKey,
        [],
        sources.slice(i, i + 5),
        TOKEN_2022_PROGRAM_ID,
      ),
    );
  }
  if (mintWithheld > 0n) {
    tx.add(
      createWithdrawWithheldTokensFromMintInstruction(
        mint,
        destination,
        protocol.publicKey,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );
  }
  return sendPoolTx(tx, [payer, protocol]);
}

async function splitAssetToVaults(opts: {
  payer: Keypair;
  ctx: AdapterContext;
  mint: PublicKey;
  program: PublicKey;
  decimals: number;
  fromAta: PublicKey;
  fromAuthority: Keypair;
  amount: bigint;
  splits: readonly number[];
  isToken2022: boolean;
}): Promise<string> {
  void opts.isToken2022;
  const shares = harvestShares(opts.amount, opts.splits);
  if (!shares.length) throw new Error("No harvestable Custom Launch fees.");
  let lastSig = "";
  for (let i = 0; i < shares.length; i += 3) {
    const chunk = shares.slice(i, i + 3);
    const tx = await freshTx(opts.payer.publicKey);
    for (const row of chunk) {
      const owner =
        row.name === "orbitx" ? protocolOwner() : customLaunchVaultKeypair(opts.ctx.launchId, row.name).publicKey;
      const dest = getAssociatedTokenAddressSync(opts.mint, owner, false, opts.program);
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          opts.payer.publicKey,
          dest,
          owner,
          opts.mint,
          opts.program,
        ),
        createTransferCheckedInstruction(
          opts.fromAta,
          opts.mint,
          dest,
          opts.fromAuthority.publicKey,
          row.share,
          opts.decimals,
          [],
          opts.program,
        ),
      );
    }
    lastSig = await sendPoolTx(tx, [opts.payer, opts.fromAuthority]);
  }
  return lastSig;
}

export async function swapSolanaPool(opts: {
  ctx: AdapterContext;
  quoteIn: boolean;
  amountIn: bigint;
  minOut: bigint;
  trader: Keypair;
  destOwner?: PublicKey;
  burnOut?: boolean;
}): Promise<ExecuteResult> {
  if (!opts.ctx.tokenAddress || !opts.ctx.poolAddress) throw new Error("Missing Solana Custom Launch pool.");
  const tradeFeeBps = opts.ctx.tradeFeeBps;
  if (tradeFeeBps == null) throw new Error("Trading fee is required to swap.");
  const payer = await deskSolanaKey(opts.ctx.userId);
  const pool = customLaunchPoolKeypair(opts.ctx.launchId);
  const router = customLaunchFeeRouterKeypair(opts.ctx.launchId);
  const tokenMint = new PublicKey(opts.ctx.tokenAddress);
  const quote = quoteSpec(opts.ctx.quoteAddress || SOLANA_WSOL);
  const trader = opts.trader;
  const destOwner = opts.destOwner ?? trader.publicKey;
  const reserves = await readSolanaPoolReserves({
    poolAddress: pool.publicKey.toBase58(),
    tokenAddress: tokenMint.toBase58(),
    quoteAddress: quote.mint.toBase58(),
  });
  const { amountOut, fee } = swapQuoteOut({
    quoteIn: opts.quoteIn,
    amountIn: opts.amountIn,
    tradeFeeBps,
    reserveToken: reserves.token,
    reserveQuote: reserves.quote,
  });
  if (amountOut < opts.minOut || amountOut === 0n) throw new Error("Slippage");

  const mintAccount = await getMint(solanaConnection(), tokenMint, "confirmed", TOKEN_2022_PROGRAM_ID);
  const poolToken = tokenAta(tokenMint, pool.publicKey);
  const poolQuote = quoteAta(quote.mint, pool.publicKey);
  const routerToken = tokenAta(tokenMint, router.publicKey);
  const routerQuote = quoteAta(quote.mint, router.publicKey);
  const traderToken = tokenAta(tokenMint, destOwner);
  const traderQuote = quoteAta(quote.mint, trader.publicKey);

  const tx = await freshTx(payer.publicKey);
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      traderToken,
      destOwner,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      routerToken,
      router.publicKey,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      routerQuote,
      router.publicKey,
      quote.mint,
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      poolQuote,
      pool.publicKey,
      quote.mint,
      TOKEN_PROGRAM_ID,
    ),
  );

  if (opts.quoteIn) {
    const have = await ataAmount(traderQuote, TOKEN_PROGRAM_ID);
    if (have < opts.amountIn) {
      if (quote.isNative && (await nativeLamports(trader.publicKey)) >= opts.amountIn) {
        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(
            payer.publicKey,
            traderQuote,
            trader.publicKey,
            quote.mint,
            TOKEN_PROGRAM_ID,
          ),
          SystemProgram.transfer({
            fromPubkey: trader.publicKey,
            toPubkey: traderQuote,
            lamports: Number(opts.amountIn),
          }),
          createSyncNativeInstruction(traderQuote),
        );
      } else {
        throw new Error("Swap input vault does not hold enough quote.");
      }
    }
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        traderQuote,
        trader.publicKey,
        quote.mint,
        TOKEN_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(
        traderQuote,
        quote.mint,
        poolQuote,
        trader.publicKey,
        opts.amountIn,
        quote.decimals,
      ),
    );
    if (fee > 0n) {
      tx.add(
        createTransferCheckedInstruction(poolQuote, quote.mint, routerQuote, pool.publicKey, fee, quote.decimals),
      );
    }
    if (opts.burnOut) {
      tx.add(createBurnInstruction(poolToken, tokenMint, pool.publicKey, amountOut, [], TOKEN_2022_PROGRAM_ID));
    } else {
      tx.add(
        createTransferCheckedInstruction(
          poolToken,
          tokenMint,
          traderToken,
          pool.publicKey,
          amountOut,
          mintAccount.decimals,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      );
    }
  } else {
    const haveToken = await ataAmount(tokenAta(tokenMint, trader.publicKey), TOKEN_2022_PROGRAM_ID);
    if (haveToken < opts.amountIn) throw new Error("Swap input vault does not hold enough token.");
    tx.add(
      createTransferCheckedInstruction(
        tokenAta(tokenMint, trader.publicKey),
        tokenMint,
        poolToken,
        trader.publicKey,
        opts.amountIn,
        mintAccount.decimals,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    if (fee > 0n) {
      tx.add(
        createTransferCheckedInstruction(
          poolToken,
          tokenMint,
          routerToken,
          pool.publicKey,
          fee,
          mintAccount.decimals,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      );
    }
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        traderQuote,
        destOwner,
        quote.mint,
        TOKEN_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(
        poolQuote,
        quote.mint,
        quoteAta(quote.mint, destOwner),
        pool.publicKey,
        amountOut,
        quote.decimals,
      ),
    );
  }

  const signature = await sendPoolTx(tx, [payer, trader, pool]);
  return {
    txHash: signature,
    explorer: explorerTx(signature),
    received: amountOut.toString(),
    status: "completed",
  };
}

export { quoteAta, tokenAta, ataAmount };
