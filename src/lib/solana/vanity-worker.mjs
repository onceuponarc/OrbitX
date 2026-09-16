import { parentPort, workerData } from "node:worker_threads";
import { Keypair } from "@solana/web3.js";

/**
 * Vanity mint miner. Runs in a worker thread so the Next.js event loop is never
 * blocked by the search. Reports progress periodically so the parent can report
 * a real attempt count, and posts the secret key on the first exact match.
 *
 * The match here is case-SENSITIVE on purpose: base58 is case-sensitive, so a
 * lowercased comparison would accept addresses that do not actually end in the
 * requested suffix.
 */
const suffix = String(workerData.suffix);
const reportEvery = Number(workerData.reportEvery) || 5_000;

let since = 0;
for (;;) {
  const keypair = Keypair.generate();
  since += 1;
  if (keypair.publicKey.toBase58().endsWith(suffix)) {
    parentPort?.postMessage({ secretKey: Array.from(keypair.secretKey), tries: since });
    break;
  }
  if (since >= reportEvery) {
    parentPort?.postMessage({ tries: since });
    since = 0;
  }
}
