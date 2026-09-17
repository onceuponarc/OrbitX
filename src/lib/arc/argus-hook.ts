import {
  concatHex,
  encodeAbiParameters,
  getAddress,
  getContractAddress,
  keccak256,
  stringToHex,
  toHex,
  type Address,
  type Hex,
} from "viem";
import hookCreation from "./argus-hook-creation.json" with { type: "json" };

const ARGUS_HOOK_CREATION_PREFIX = hookCreation.prefix as Hex;

/** Uniswap v4 flags encoded in Argus hook addresses: BEFORE_INITIALIZE | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA. */
export const ARGUS_HOOK_FLAGS = 0x2044n;
const HOOK_FLAG_MASK = 0x3fffn;
const MINE_LIMIT = 2_000_000;

const CLONE_HEAD = "0x3d602d80600a3d3981f3363d3d373d3d3d363d73" as Hex;
const CLONE_TAIL = "0x5af43d82803e903d91602b57fd5bf3" as Hex;
const SPLITTER_NS = stringToHex("ARGUS_V4_HOOKED_SPLITTER", { size: 32 });

export const ARGUS_POOL_FEE = 10_000;
export const ARGUS_TICK_SPACING = 200;

export function cloneInitcode(implementation: Address): Hex {
  return concatHex([CLONE_HEAD, getAddress(implementation), CLONE_TAIL]);
}

export function create2Address(deployer: Address, salt: Hex, bytecode: Hex): Address {
  return getContractAddress({ opcode: "CREATE2", from: getAddress(deployer), salt, bytecode });
}

export function create2AddressFromHash(deployer: Address, salt: Hex, bytecodeHash: Hex): Address {
  return getContractAddress({ opcode: "CREATE2", from: getAddress(deployer), salt, bytecodeHash });
}

export function tokenCreate2Salt(sender: Address, userSalt: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [getAddress(sender), userSalt]));
}

export function splitterCreate2Salt(sender: Address, userSalt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "bytes32" }],
      [getAddress(sender), userSalt, SPLITTER_NS],
    ),
  );
}

export function hookCreate2Salt(sender: Address, hookSalt: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [getAddress(sender), hookSalt]));
}

export function predictClone(portal: Address, salt: Hex, implementation: Address): Address {
  return create2Address(portal, salt, cloneInitcode(implementation));
}

export function buildHookInitcode(input: {
  portal: Address;
  poolManager: Address;
  splitter: Address;
  treasury: Address;
  quoteAsset: Address;
  poolFee?: number;
  tickSpacing?: number;
  buyTaxBps: number;
  sellTaxBps: number;
}): Hex {
  const args = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
    ],
    [
      getAddress(input.poolManager),
      getAddress(input.portal),
      getAddress(input.splitter),
      getAddress(input.treasury),
      getAddress(input.quoteAsset),
      BigInt(input.poolFee ?? ARGUS_POOL_FEE),
      BigInt(input.tickSpacing ?? ARGUS_TICK_SPACING),
      BigInt(input.buyTaxBps),
      BigInt(input.sellTaxBps),
    ],
  );
  return concatHex([ARGUS_HOOK_CREATION_PREFIX, args]);
}

export function mineHookSalt(input: {
  portal: Address;
  sender: Address;
  initcodeHash: Hex;
  start?: bigint;
}): { hookSalt: Hex; hook: Address; attempts: number } {
  const portal = getAddress(input.portal);
  const sender = getAddress(input.sender);
  const n = input.start ?? randomUint256();
  for (let i = 0; i < MINE_LIMIT; i++) {
    const hookSalt = toHex(n + BigInt(i), { size: 32 });
    const hook = create2AddressFromHash(portal, hookCreate2Salt(sender, hookSalt), input.initcodeHash);
    if ((BigInt(hook) & HOOK_FLAG_MASK) === ARGUS_HOOK_FLAGS) {
      return { hookSalt, hook, attempts: i + 1 };
    }
  }
  throw new Error("Could not mine a Uniswap v4 hook salt with the Argus flag bits.");
}

export function prepareArgusLaunch(input: {
  portal: Address;
  sender: Address;
  userSalt: Hex;
  tokenImpl: Address;
  splitterImpl: Address;
  poolManager: Address;
  treasury: Address;
  quoteAsset: Address;
  buyTaxBps: number;
  sellTaxBps: number;
  poolFee?: number;
  tickSpacing?: number;
}) {
  const tokenSalt = tokenCreate2Salt(input.sender, input.userSalt);
  const token = predictClone(input.portal, tokenSalt, input.tokenImpl);
  const splitter = predictClone(input.portal, splitterCreate2Salt(input.sender, input.userSalt), input.splitterImpl);
  const initcode = buildHookInitcode({
    portal: input.portal,
    poolManager: input.poolManager,
    splitter,
    treasury: input.treasury,
    quoteAsset: input.quoteAsset,
    poolFee: input.poolFee,
    tickSpacing: input.tickSpacing,
    buyTaxBps: input.buyTaxBps,
    sellTaxBps: input.sellTaxBps,
  });
  const initcodeHash = keccak256(initcode);
  const mined = mineHookSalt({ portal: input.portal, sender: input.sender, initcodeHash });
  return { token, splitter, initcode, initcodeHash, tokenSalt, ...mined };
}

function randomUint256(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  bytes[0] &= 0x7f;
  return BigInt(toHex(bytes));
}
