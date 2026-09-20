import { Keypair, PublicKey, SendTransactionError, Transaction } from "@solana/web3.js";
import { solanaConnections } from "@/lib/solana/connection";
import { fetchLatestBlockhash, parseBlockhash } from "@/lib/solana/blockhash";
import { serverSolanaRpcs } from "@/lib/solana/rpc-urls";

const MAX_TX_BYTES = 1232;
const CONFIRM_MS = 50_000;

export async function serializePartialTx(
  tx: Transaction,
  feePayer: PublicKey,
  extraSigners: Keypair[],
  recentBlockhash?: string | null,
) {
  const blockhash = parseBlockhash(recentBlockhash);
  const latest = blockhash
    ? { blockhash, lastValidBlockHeight: 0 }
    : await fetchLatestBlockhash(serverSolanaRpcs());
  tx.feePayer = feePayer;
  tx.recentBlockhash = latest.blockhash;
  if (extraSigners.length) tx.partialSign(...extraSigners);
  const raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  if (raw.length > MAX_TX_BYTES) {
    throw new Error("Transaction is too large for Solana. Retry with a smaller deposit.");
  }
  return {
    transaction: raw.toString("base64"),
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}

function programFailureMessage(error: unknown): string | null {
  const logs =
    error instanceof SendTransactionError
      ? error.logs ?? []
      : [];
  const message = error instanceof Error ? error.message : String(error);
  const haystack = `${message}\n${logs.join("\n")}`;
  if (/Instruction not supported for ProgrammableNonFungible/i.test(haystack) || /custom program error: 0x99/i.test(haystack)) {
    return "Token-2022 metadata must use Metaplex CreateV1. CreateMetadataAccountV3 is not supported on this mint.";
  }
  if (/simulation failed|custom program error|InstructionError|0x[0-9a-f]+/i.test(haystack)) {
    const logLine = logs.find((line) => /error|failed|0x/i.test(line)) ?? message;
    return logLine.slice(0, 400);
  }
  return null;
}

export async function sendSignedTx(signedBase64: string) {
  const raw = Buffer.from(signedBase64, "base64");
  let lastError: unknown;
  for (const connection of solanaConnections()) {
    try {
      return await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: "confirmed",
      });
    } catch (error) {
      const programError = programFailureMessage(error);
      if (programError) throw new Error(programError);
      lastError = error;
    }
  }
  const fallback = solanaConnections()[0];
  if (fallback) {
    try {
      return await fallback.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 3 });
    } catch (error) {
      const programError = programFailureMessage(error);
      if (programError) throw new Error(programError);
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not land the transaction.");
}

export function explorerFromSig(signature: string) {
  return `https://explorer.solana.com/tx/${signature}`;
}

function onChainFailureMessage(err: unknown, logs: string[] | null | undefined): string {
  const text = JSON.stringify(err);
  const haystack = `${text}\n${(logs ?? []).join("\n")}`;
  if (/Instruction not supported for ProgrammableNonFungible/i.test(haystack) || text.includes('"Custom":153')) {
    return "Token-2022 metadata must use Metaplex CreateV1. CreateMetadataAccountV3 is not supported on this mint.";
  }
  const logLine = (logs ?? []).find((line) => /error|failed|0x/i.test(line));
  return logLine ? `${logLine.slice(0, 300)}` : `Transaction failed on-chain: ${text}`;
}

async function readSignatureOutcome(signature: string) {
  for (const connection of solanaConnections()) {
    const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true }).catch(() => null);
    const value = status?.value;
    if (!value) continue;
    if (value.err) {
      const tx = await connection
        .getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })
        .catch(() => null);
      throw new Error(onChainFailureMessage(value.err, tx?.meta?.logMessages));
    }
    if (value.confirmationStatus === "confirmed" || value.confirmationStatus === "finalized") {
      return true;
    }
  }
  return false;
}

export async function waitForTx(signature: string, lastValidBlockHeight?: number) {
  const started = Date.now();
  while (Date.now() - started < CONFIRM_MS) {
    if (await readSignatureOutcome(signature)) return;
    if (lastValidBlockHeight && lastValidBlockHeight > 0) {
      for (const connection of solanaConnections()) {
        const height = await connection.getBlockHeight("confirmed").catch(() => 0);
        if (height > lastValidBlockHeight) {
          if (await readSignatureOutcome(signature)) return;
          throw new Error(
            `Signature ${signature} has expired: block height exceeded. The mint did not land — retry deploy.`,
          );
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  if (await readSignatureOutcome(signature)) return;
  throw new Error(`Signature ${signature} was not confirmed in time. Retry deploy.`);
}

export { parseBlockhash };
