import "server-only";

import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { solanaConnection } from "@/lib/solana/connection";
import { fetchLatestBlockhash } from "@/lib/solana/blockhash";
import { serverSolanaRpcs } from "@/lib/solana/rpc-urls";
import {
  getJupiterSwapInstructions,
  type JupiterQuote,
  type JupiterRawInstruction,
} from "@/lib/solana/jupiter";
import {
  WSOL_MINT,
  feeTransferInstructions,
  type FeeBreakdown,
} from "@/lib/solana/orbitx-fee";

function decode(ix: JupiterRawInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((a) => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
}

/**
 * Build ONE transaction containing both the Jupiter swap and the OrbitX revenue
 * fee transfer. Because they share a transaction they share a fate: the fee
 * cannot be collected on a trade that failed, and a successful trade cannot skip
 * the fee.
 *
 * Instruction ordering matters and differs by side:
 *  - buy: the fee leaves the payer BEFORE the swap, so the swap only ever moves
 *    the net amount the quote promised.
 *  - sell into USDC: the fee is taken AFTER the swap, once proceeds have landed
 *    in the payer's token account.
 *  - sell into SOL: the fee is taken after Jupiter's CLEANUP instruction, which
 *    is what closes the temporary WSOL account and returns real SOL to the payer.
 *    Taking it earlier would try to spend lamports that are still wrapped.
 */
export async function buildAtomicSwapTx(opts: {
  quote: JupiterQuote;
  payer: PublicKey;
  fee: FeeBreakdown;
  feeDecimals: number;
}): Promise<{ transaction: VersionedTransaction; lastValidBlockHeight: number }> {
  const built = await getJupiterSwapInstructions(opts.quote, opts.payer.toBase58());

  const feeIxs = feeTransferInstructions({
    payer: opts.payer,
    feeMint: opts.fee.feeMint,
    feeRaw: opts.fee.feeRaw,
    decimals: opts.feeDecimals,
  });

  const head: TransactionInstruction[] = [
    ...(built.tokenLedgerInstruction ? [decode(built.tokenLedgerInstruction)] : []),
    ...built.computeBudgetInstructions.map(decode),
    ...built.setupInstructions.map(decode),
  ];
  const swap = decode(built.swapInstruction);
  const cleanup = built.cleanupInstruction ? [decode(built.cleanupInstruction)] : [];

  let instructions: TransactionInstruction[];
  if (opts.fee.side === "buy") {
    instructions = [...head, ...feeIxs, swap, ...cleanup];
  } else if (opts.fee.feeMint === WSOL_MINT) {
    instructions = [...head, swap, ...cleanup, ...feeIxs];
  } else {
    instructions = [...head, swap, ...feeIxs, ...cleanup];
  }

  const connection = solanaConnection();
  const lookupTables: AddressLookupTableAccount[] = [];
  for (const address of built.addressLookupTableAddresses ?? []) {
    const account = await connection.getAddressLookupTable(new PublicKey(address));
    if (!account.value) {
      throw new Error("Could not load a route lookup table. Retry the trade.");
    }
    lookupTables.push(account.value);
  }

  const latest = await fetchLatestBlockhash(serverSolanaRpcs());
  const message = new TransactionMessage({
    payerKey: opts.payer,
    recentBlockhash: latest.blockhash,
    instructions,
  }).compileToV0Message(lookupTables);

  return {
    transaction: new VersionedTransaction(message),
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}

/**
 * Confirm the OrbitX fee actually moved in the landed transaction, by reading the
 * revenue wallet's balance delta out of the confirmed transaction's own meta.
 * Used so a trade is never reported as fee-paid on the strength of our intent
 * rather than on-chain fact.
 */
export async function verifyFeeCollected(opts: {
  signature: string;
  feeMint: string;
  feeRaw: bigint;
  revenueWallet: PublicKey;
}): Promise<{ collected: boolean; observedRaw: bigint | null }> {
  if (opts.feeRaw <= 0n) return { collected: true, observedRaw: 0n };
  const connection = solanaConnection();
  const tx = await connection.getTransaction(opts.signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx?.meta) return { collected: false, observedRaw: null };

  if (opts.feeMint === WSOL_MINT) {
    const keys = tx.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx.meta.loadedAddresses ?? undefined,
    });
    const index = keys.staticAccountKeys.findIndex((k) => k.equals(opts.revenueWallet));
    if (index < 0) return { collected: false, observedRaw: null };
    const delta = BigInt(tx.meta.postBalances[index] ?? 0) - BigInt(tx.meta.preBalances[index] ?? 0);
    return { collected: delta >= opts.feeRaw, observedRaw: delta };
  }

  const owner = opts.revenueWallet.toBase58();
  const pre = (tx.meta.preTokenBalances ?? []).find(
    (b) => b.owner === owner && b.mint === opts.feeMint,
  );
  const post = (tx.meta.postTokenBalances ?? []).find(
    (b) => b.owner === owner && b.mint === opts.feeMint,
  );
  if (!post) return { collected: false, observedRaw: null };
  const delta =
    BigInt(post.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? "0");
  return { collected: delta >= opts.feeRaw, observedRaw: delta };
}
