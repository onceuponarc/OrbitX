import { Keypair } from "@solana/web3.js";
import { generateVanityMint, resolveLaunchMint, vanityMintFromSecret, VANITY_MINE_BUDGET_MS } from "../src/lib/solana/vanity-mine.ts";
import { mintEndsWith, VANITY_SUFFIX } from "../src/lib/solana/vanity.ts";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

assert(VANITY_SUFFIX === "obx", "suffix");
assert(mintEndsWith("Abcdefobx"), "ends with");
assert(!mintEndsWith("Abcdefxyz"), "does not end");

const skipped = await resolveLaunchMint(false);
assert(!skipped.vanity, "vanity=false must skip mining");
assert(skipped.tries === 1, "vanity=false tries");

const quick = await generateVanityMint("x", 3_000);
assert(quick.vanity, "1-char suffix should mine in 3s");
assert(mintEndsWith(quick.keypair.publicKey.toBase58(), "x"), "1-char address");
assert(Keypair.fromSecretKey(quick.keypair.secretKey).publicKey.equals(quick.keypair.publicKey), "secret roundtrip");
const accepted = vanityMintFromSecret(Buffer.from(quick.keypair.secretKey).toString("base64"), "x");
assert(accepted?.vanity === true, "accepts premined secret");
assert(accepted?.keypair.publicKey.equals(quick.keypair.publicKey), "premined pubkey");
assert(vanityMintFromSecret("bm90LWEta2V5", "x") === null, "rejects junk secret");

const timedOut = await generateVanityMint("zzzz", 200);
assert(!timedOut.vanity, "impossible suffix falls back");
assert(timedOut.tries > 0, "records tries");

try {
  await resolveLaunchMint(true, "zzzz", 200);
  throw new Error("expected VanityTimeoutError");
} catch (error) {
  assert(error instanceof Error && error.name === "VanityTimeoutError", `timeout class: ${error}`);
}

assert(VANITY_MINE_BUDGET_MS >= 30_000, "launch budget must outlast the old 8s window");

console.log(
  JSON.stringify({
    ok: true,
    skipped: skipped.keypair.publicKey.toBase58(),
    oneChar: quick.keypair.publicKey.toBase58(),
    oneCharTries: quick.tries,
    timeoutTries: timedOut.tries,
  }),
);
