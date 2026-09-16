import { cpus } from "node:os";
import { Keypair } from "@solana/web3.js";
import {
  VANITY_SUFFIX,
  isMintableSuffix,
  mintEndsWith,
} from "@/lib/solana/vanity-match";

export { VANITY_SUFFIX, isMintableSuffix, mintEndsWith };

/** Raised when vanity mining did not find a match in budget. Retryable. */
export class VanityTimeoutError extends Error {
  readonly retryable = true;
  constructor(readonly suffix: string, readonly tries: number, readonly elapsedMs: number) {
    super(
      `Could not generate a mint ending in "${suffix}" in ${Math.round(elapsedMs / 1000)}s ` +
        `(${tries.toLocaleString()} attempts). This is a retryable timeout, not a failed launch — nothing was sent on-chain.`,
    );
    this.name = "VanityTimeoutError";
  }
}

export type VanityResult = {
  keypair: Keypair;
  tries: number;
  elapsedMs: number;
  /** Always true. A non-vanity result is never returned — it throws instead. */
  vanity: true;
};

/**
 * Mine a mint whose address ends in `suffix`, in parallel worker threads.
 *
 * Two things this deliberately does NOT do:
 *  - it never returns a random non-matching mint as a fallback. Callers used to
 *    receive `{ vanity: false }` and launch anyway, which is why launches landed
 *    on addresses that did not end in obx. Failure throws VanityTimeoutError.
 *  - it never mines on the calling thread. The previous synchronous while-loop
 *    blocked the Node event loop for its entire budget, stalling every other
 *    request on the server for up to 8s per launch.
 *
 * Expected work is 58^3 = 195_112 keypairs for a 3-char suffix, so a single
 * core often exceeded the old 8s budget — hence the fallback firing routinely.
 */
export async function generateVanityMint(
  suffix = VANITY_SUFFIX,
  budgetMs = 30_000,
  workers = defaultWorkerCount(),
): Promise<VanityResult> {
  if (!isMintableSuffix(suffix)) {
    throw new Error(
      `"${suffix}" cannot occur in a base58 address — no mint can ever end in it.`,
    );
  }

  const { Worker } = await import("node:worker_threads");
  const { fileURLToPath } = await import("node:url");
  const workerPath = fileURLToPath(new URL("./vanity-worker.mjs", import.meta.url));

  const started = Date.now();
  const pool: InstanceType<typeof Worker>[] = [];
  let tries = 0;

  try {
    return await new Promise<VanityResult>((resolve, reject) => {
      const deadline = setTimeout(() => {
        reject(new VanityTimeoutError(suffix, tries, Date.now() - started));
      }, budgetMs);

      const settleError = (error: unknown) => {
        clearTimeout(deadline);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      for (let i = 0; i < workers; i += 1) {
        const worker = new Worker(workerPath, {
          workerData: { suffix, reportEvery: 5_000 },
        });
        pool.push(worker);
        worker.on("message", (msg: { secretKey?: number[]; tries?: number }) => {
          if (typeof msg.tries === "number") tries += msg.tries;
          if (!msg.secretKey) return;
          clearTimeout(deadline);
          const keypair = Keypair.fromSecretKey(Uint8Array.from(msg.secretKey));
          // Re-verify in the parent: never trust a worker's own match claim.
          if (!mintEndsWith(keypair.publicKey.toBase58(), suffix)) {
            settleError(new Error("Vanity worker returned a non-matching mint."));
            return;
          }
          resolve({ keypair, tries, elapsedMs: Date.now() - started, vanity: true });
        });
        worker.on("error", settleError);
      }
    });
  } finally {
    await Promise.all(pool.map((w) => w.terminate().catch(() => undefined)));
  }
}

export type LaunchMint = { keypair: Keypair; tries: number; vanity: boolean };

/**
 * Single entry point every launch path uses to obtain its mint.
 *
 * When vanity is requested this either returns a mint that genuinely ends in the
 * suffix, or throws VanityTimeoutError. There is no third outcome: the old code
 * returned `{ vanity: false }` here and every caller launched anyway.
 */
export async function resolveLaunchMint(
  vanityRequested: boolean,
  suffix = VANITY_SUFFIX,
): Promise<LaunchMint> {
  if (!vanityRequested) {
    return { keypair: Keypair.generate(), tries: 1, vanity: false };
  }
  const result = await generateVanityMint(suffix);
  return { keypair: result.keypair, tries: result.tries, vanity: true };
}

function defaultWorkerCount() {
  const env = Number(process.env.VANITY_WORKERS ?? "");
  if (Number.isFinite(env) && env >= 1) return Math.min(16, Math.floor(env));
  // Leave a core for the request/event loop.
  const cores = cpus()?.length ?? 2;
  return Math.max(1, Math.min(8, cores - 1));
}
