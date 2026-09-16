import "server-only";

import {
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ORBITX_REVENUE_WALLET as REVENUE_WALLET_ADDRESS,
  WSOL_MINT,
} from "@/lib/solana/orbitx-fee-math";

export * from "@/lib/solana/orbitx-fee-math";

export const ORBITX_REVENUE_PUBKEY = new PublicKey(REVENUE_WALLET_ADDRESS);

/**
 * Instructions moving `feeRaw` of `feeMint` from the payer to the OrbitX revenue
 * wallet. Returned as instructions, not a transaction, so the caller splices them
 * into the same transaction as the swap — the fee must never be its own
 * transaction that can succeed or fail independently of the trade.
 *
 * For SPL fees the revenue ATA is created idempotently in the same transaction,
 * so a first-ever USDC fee cannot fail on a missing destination account.
 */
export function feeTransferInstructions(opts: {
  payer: PublicKey;
  feeMint: string;
  feeRaw: bigint;
  decimals: number;
}): TransactionInstruction[] {
  if (opts.feeRaw <= 0n) return [];

  if (opts.feeMint === WSOL_MINT) {
    return [
      SystemProgram.transfer({
        fromPubkey: opts.payer,
        toPubkey: ORBITX_REVENUE_PUBKEY,
        lamports: opts.feeRaw,
      }),
    ];
  }

  const mint = new PublicKey(opts.feeMint);
  const source = getAssociatedTokenAddressSync(mint, opts.payer, true);
  const destination = getAssociatedTokenAddressSync(mint, ORBITX_REVENUE_PUBKEY, true);
  return [
    createAssociatedTokenAccountIdempotentInstruction(
      opts.payer,
      destination,
      ORBITX_REVENUE_PUBKEY,
      mint,
    ),
    createTransferCheckedInstruction(
      source,
      mint,
      destination,
      opts.payer,
      opts.feeRaw,
      opts.decimals,
    ),
  ];
}

/** Lamports of headroom reserved for network + priority fees and ATA rent. */
export const SOL_TX_HEADROOM_LAMPORTS = 7_000_000n;
