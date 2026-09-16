export type Amount = {
  atomic: bigint;
  decimals: number;
  asset: string;
};

export const ARC_TESTNET = {
  name: "Arc Testnet",
  chainId: 5042002,
  hexChainId: "0x4CEF52",
  caip2: "eip155:5042002",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  usdcNativeDecimals: 18,
  usdcErc20: "0x3600000000000000000000000000000000000000" as const,
  usdcErc20Decimals: 6,
  eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as const,
  rpcUrls: [
    "https://rpc.testnet.arc.io",
    "https://rpc.testnet.arc.network",
    "https://rpc.blockdaemon.testnet.arc.io",
    "https://rpc.drpc.testnet.arc.io",
    "https://rpc.quicknode.testnet.arc.io",
  ],
  wsUrls: ["wss://rpc.testnet.arc.io", "wss://rpc.testnet.arc.network"],
  explorer: "https://testnet.arcscan.app",
  faucet: "https://faucet.circle.com",
  cctp: {
    tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    tokenMinterV2: "0xb43db544E2c27092c107639Ad201b3dEfAbcF192",
    messageV2: "0xbaC0179bB358A8936169a63408C8481D582390C4",
  },
  gateway: {
    wallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    minter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
  },
  factory: "0x3FD6f451803CD0eC616da6Ef8228E6EC56C24086" as `0x${string}`,
  router: null as `0x${string}` | null,
  vaultImpl: null as `0x${string}` | null,
  feeHook: null as `0x${string}` | null,
} as const;

/** Local Anvil slice that mirrors Arc Chapter contracts for launch / buy / sell. */
export const ARC_DEVNET = {
  name: "Arc Devnet",
  chainId: 31337,
  hexChainId: "0x7A69",
  caip2: "eip155:31337",
  rpcUrl: "http://127.0.0.1:8546",
  explorer: "http://127.0.0.1:8546",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  note: "ETH for gas, MockUSDC as Chapter quote. Same factory and curve as Arc Testnet. Public Arc uses USDC for gas.",
} as const;

export const ARC_MAINNET = {
  name: "Arc",
  chainId: 5042,
  hexChainId: "0x13B2",
  caip2: "eip155:5042",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  usdcNativeDecimals: 18,
  usdcErc20: "0x3600000000000000000000000000000000000000" as const,
  usdcErc20Decimals: 6,
  rpcUrls: [
    "https://rpc.mainnet.arc.io",
  ],
  explorer: "https://arcscan.app",
  factory: "0x3FD6f451803CD0eC616da6Ef8228E6EC56C24086" as `0x${string}`,
  note: "Early public mainnet. Chain 5042. Same USDC precompile as testnet.",
} as const;

export const ARC_MAINNET_PENDING = ARC_MAINNET;

export function isPublicArc(chainId: number) {
  return chainId === ARC_MAINNET.chainId || chainId === ARC_TESTNET.chainId;
}

export const PROTOCOL = {
  protocolBpsDefault: 20,
  protocolBpsMin: 10,
  protocolBpsMax: 30,
  authorModeAuthorBpsCap: 300,
  onceuponersAuthorBpsCap: 100,
  authorModeSuggestedBps: 100,
  defaultSupply: BigInt("1000000000"),
  defaultDecimals: 18,
  bondingGraduationUsdc: 5_000,
} as const;

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function authorFeeExample(buyUsdc: number, authorBps: number): number {
  return (buyUsdc * authorBps) / 10_000;
}
