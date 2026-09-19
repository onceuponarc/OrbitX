import "server-only";

import { ComputeBudgetProgram, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { onlinePumpSdk } from "@/lib/solana/pump-sdk";
import { serializePartialTx } from "@/lib/solana/partial-tx";
import { pumpCollectFeeTx } from "@/lib/solana/pumpportal";
import { vaultsHaveClaimableFees } from "@/lib/solana/claim-fees-util";

export { vaultsHaveClaimableFees };

const VAULT_MS = 15_000;
const BUILD_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function packCollectTx(creator: PublicKey, ixs: TransactionInstruction[]) {
  if (!ixs.length) throw new Error("Nothing to claim right now.");
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ...ixs,
  );
  const packed = await serializePartialTx(tx, creator, []);
  return { transaction: packed.transaction, versioned: false as const };
}

/** Build a desk-signed collect from on-chain vaults. Never waits on PumpPortal unless the SDK path fails after fees are owed. */
export async function collectCreatorFeeTransaction(creator: PublicKey) {
  const sdk = onlinePumpSdk();
  const balances = await withTimeout(
    sdk.getCreatorVaultQuoteBalances(creator),
    VAULT_MS,
    "Timed out reading creator fee vaults.",
  );
  if (!vaultsHaveClaimableFees(balances)) {
    throw new Error("Nothing to claim right now.");
  }

  try {
    const ixs = await withTimeout(
      sdk.collectCoinCreatorFeeAllQuotesInstructions(creator),
      BUILD_MS,
      "Timed out building the fee-claim transaction.",
    );
    if (!ixs.length) throw new Error("Could not build the fee-claim transaction.");
    try {
      return await packCollectTx(creator, ixs);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("too large")) throw error;
      const solIxs = await withTimeout(
        sdk.collectCoinCreatorFeeInstructions(creator),
        BUILD_MS,
        "Timed out building the SOL fee-claim transaction.",
      );
      return await packCollectTx(creator, solIxs);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Nothing to claim")) throw error;
    const transaction = await pumpCollectFeeTx(creator.toBase58());
    return { transaction, versioned: "auto" as const };
  }
}
