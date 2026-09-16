import { PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";

/** Wrapped SOL mint used by Jupiter pricing and the Solana launch fee. */
export const WSOL_MINT = "So11111111111111111111111111111111111111112";

/** OrbitX launch-fee recipient on Solana mainnet. */
export const SOLANA_REVENUE_WALLET = "2WpoUM5YHKZF6xWM3qEx5f7gFGtNt6kAJyQM8dU44CzDs";

/** Launch fee in USD, as specified for the production launch flow. */
export const SOLANA_LAUNCH_FEE_USD = 0.25;

export function launchFeeLamports(solUsd: number): number {
  if (!Number.isFinite(solUsd) || solUsd <= 0) throw new Error("SOL price is unavailable.");
  const lamports = Math.ceil((SOLANA_LAUNCH_FEE_USD / solUsd) * 1_000_000_000);
  if (!Number.isSafeInteger(lamports) || lamports <= 0) throw new Error("Launch fee could not be calculated.");
  return lamports;
}

export function feeTransferInstructions(opts: {
  payer: PublicKey;
  feeMint: string;
  feeRaw: number;
  decimals: number;
}): TransactionInstruction[] {
  if (opts.feeMint !== WSOL_MINT || opts.decimals !== 9) {
    throw new Error("Solana launch fees must be paid in native SOL.");
  }
  if (!Number.isSafeInteger(opts.feeRaw) || opts.feeRaw <= 0) {
    throw new Error("Solana launch fee must be a positive integer amount.");
  }
  return [
    SystemProgram.transfer({
      fromPubkey: opts.payer,
      toPubkey: new PublicKey(SOLANA_REVENUE_WALLET),
      lamports: opts.feeRaw,
    }),
  ];
}
