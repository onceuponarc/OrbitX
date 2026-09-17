import {
  concatHex,
  encodeAbiParameters,
  getAddress,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import hookCreation from "../src/lib/arc/argus-hook-creation.json" with { type: "json" };
const ARGUS_HOOK_CREATION_PREFIX = hookCreation.prefix as `0x${string}`;
import {
  ARGUS_HOOK_FLAGS,
  buildHookInitcode,
  create2AddressFromHash,
  hookCreate2Salt,
  mineHookSalt,
  predictClone,
  splitterCreate2Salt,
  tokenCreate2Salt,
} from "../src/lib/arc/argus-hook.ts";

const PORTAL = "0xB021Be536808f551b31789422Fd28a6c9c6e97Da" as Address;
const SENDER = "0xc9b8bdd10ff1673a39109720a145e4ff61ad790f" as Address;
const USER_SALT = "0xfbe3e417179699cd694dd35a079a71ecf63a4917eccf22822ebca43ff48a9be6" as Hex;
const HOOK_SALT = "0x0000000000000000cfeda45a30ad8564cb05ed23dce7b58f98212dafb0e9b62c" as Hex;
const TOKEN_IMPL = "0x1b74922c01DdFd9c77b37d02c0a236611E8FE500" as Address;
const SPLITTER_IMPL = "0xD9578Dd861B2fe59675c2C4B09b026fcB0dF37fc" as Address;
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as Address;
const TREASURY = "0x934dEa9aB179DE155db10519AA89A8c418c50705" as Address;
const USDC = "0x3600000000000000000000000000000000000000" as Address;
const EXPECT_TOKEN = "0x810d51ac47380ec977b5b0ef0c7bfec3c948d1d0";
const EXPECT_SPLITTER = "0x2606e1ea56e57ab82a9aa1406c0f4aa03b545da8";
const EXPECT_HOOK = "0x7c5a33c255f4bfc512d8c4cbc1dc983643e16044";
const EXPECT_INIT_HASH = "0x6278e172c7346c8c45aeda9a3c7bd7ece11a425b8f4b0877f2f83d86d634b20a";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const token = predictClone(PORTAL, tokenCreate2Salt(SENDER, USER_SALT), TOKEN_IMPL);
assert(token.toLowerCase() === EXPECT_TOKEN, `token ${token}`);

const splitter = predictClone(PORTAL, splitterCreate2Salt(SENDER, USER_SALT), SPLITTER_IMPL);
assert(splitter.toLowerCase() === EXPECT_SPLITTER, `splitter ${splitter}`);

const initcode = buildHookInitcode({
  portal: PORTAL,
  poolManager: POOL_MANAGER,
  splitter,
  treasury: TREASURY,
  quoteAsset: USDC,
  buyTaxBps: 300,
  sellTaxBps: 300,
});
const initcodeHash = keccak256(initcode);
assert(initcodeHash === EXPECT_INIT_HASH, `initcodeHash ${initcodeHash}`);

const hook = create2AddressFromHash(PORTAL, hookCreate2Salt(SENDER, HOOK_SALT), initcodeHash);
assert(hook.toLowerCase() === EXPECT_HOOK, `hook ${hook}`);
assert((BigInt(hook) & 0x3fffn) === ARGUS_HOOK_FLAGS, `flags ${hook}`);

const mined = mineHookSalt({ portal: PORTAL, sender: SENDER, initcodeHash, start: 1n });
assert((BigInt(mined.hook) & 0x3fffn) === ARGUS_HOOK_FLAGS, `mined flags ${mined.hook}`);
assert(
  create2AddressFromHash(PORTAL, hookCreate2Salt(SENDER, mined.hookSalt), initcodeHash).toLowerCase() ===
    mined.hook.toLowerCase(),
  "mined salt mismatch",
);

const ctor = encodeAbiParameters(
  Array.from({ length: 9 }, () => ({ type: "uint256" as const })),
  [
    BigInt(getAddress(POOL_MANAGER)),
    BigInt(getAddress(PORTAL)),
    BigInt(getAddress(splitter)),
    BigInt(getAddress(TREASURY)),
    BigInt(getAddress(USDC)),
    10_000n,
    200n,
    300n,
    300n,
  ],
);
assert(concatHex([ARGUS_HOOK_CREATION_PREFIX, ctor]) === initcode, "ctor encoding");

console.log(JSON.stringify({ ok: true, token, splitter, hook, minedAttempts: mined.attempts, minedHook: mined.hook }));
