export const SOLANA = {
  name: "Solana Mainnet",
  cluster: "mainnet-beta" as const,
  caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  explorer: "https://explorer.solana.com",
  rpcUrl: "https://api.mainnet-beta.solana.com",
  nativeSymbol: "SOL",
  defaultDecimals: 6,
  nftDecimals: 0,
  defaultSupply: 1_000_000_000,
  bondingGraduationSol: 2,
  virtualQuoteSol: 30,
  protocolBpsDefault: 20,
  /** Circle USDC on Solana mainnet. */
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  /** Wrapped SOL mint used by Jupiter routes. */
  wsolMint: "So11111111111111111111111111111111111111112",
} as const;

export const JUPITER = {
  name: "Jupiter",
  quoteUrl: "https://lite-api.jup.ag/swap/v1/quote",
  swapUrl: "https://lite-api.jup.ag/swap/v1/swap",
  app: "https://jup.ag",
  perps: "https://jup.ag/perps",
  docs: "https://dev.jup.ag/docs/swap",
} as const;

export const ROBINHOOD_CHAIN = {
  name: "Robinhood Chain",
  chainId: 4663,
  caip2: "eip155:4663",
  explorer: "https://robinhoodchain.blockscout.com",
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  note: "OrbitX prints spot tokens on Robinhood Chain. No bonding curve.",
  ponsFactory: "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e",
  ponsRouter: "0xe33e9e479df8802cb0866d5d05258bec4cf62948",
} as const;

export const ETHEREUM = {
  name: "Ethereum",
  chainId: 1,
  caip2: "eip155:1",
  explorer: "https://etherscan.io",
  rpcUrl: "https://eth.llamarpc.com",
} as const;

export const BASE = {
  name: "Base",
  chainId: 8453,
  caip2: "eip155:8453",
  explorer: "https://basescan.org",
  rpcUrl: "https://mainnet.base.org",
} as const;

export type LaunchChain = "arc" | "solana" | "robinhood";
export type PrintableChain = "arc" | "solana" | "robinhood";
export type LaunchVenue = "spl" | "nft" | "pumpfun" | "pons";
export type QuoteKind = "sol" | "usdc" | "meme" | "stock" | "etf" | "treasury" | "bond" | "custom";

export const PRINTABLE_CHAIN_IDS: readonly PrintableChain[] = ["arc", "solana", "robinhood"];

export type ChainCard = {
  id: LaunchChain;
  title: string;
  live: boolean;
  prints: boolean;
  badge: string;
  body: string;
  caip2: string;
  accent: string;
  printNote: string;
};

export const CHAINS: ChainCard[] = [
  {
    id: "arc",
    title: "Arc",
    live: true,
    prints: true,
    badge: "Mainnet · 5042",
    body: "OrbitX is an Arc launchpad. Open a Chapter Curve in USDC the instant create lands. Buyers write the book. Graduation seeds the AMM from the vault. Early public mainnet, chain 5042.",
    caip2: "eip155:5042",
    accent: "from-[#00e5c3]/45 to-[#3d7cff]/30",
    printNote:
      "Native Chapter Curve on Arc. MockUSDC (Devnet) or Circle USDC (Testnet) is the quote. Buy and sell anytime. You do not seed an AMM at print. Graduation seeds the deeper pool from the book.",
  },
  {
    id: "solana",
    title: "Solana",
    live: true,
    prints: true,
    badge: "Pump.fun · vanity",
    body: "Print on pump.fun from OrbitX. Image to IPFS. Custom …obx mint. Your in-app Solana desk signs. Creator fees stay yours to claim.",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    accent: "from-[#22d3ee]/45 to-[#ffffff]/10",
    printNote: "Pump.fun curve. OrbitX metadata on every mint. Vanity suffix obx.",
  },
  {
    id: "robinhood",
    title: "Robinhood Chain",
    live: true,
    prints: true,
    badge: "Spot · no curve",
    body: "Fund your in-app RH wallet with ETH. Print a spot token. No bonding curve. Supply sits in your desk. Tradable as soon as you seed the WETH book.",
    caip2: "eip155:4663",
    accent: "from-[#00c805]/40 to-white/10",
    printNote: "ERC-20 on chain 4663. Your desk pays gas and receives fees.",
  },
];

export const VENUES: {
  id: LaunchVenue;
  title: string;
  headline: string;
  body: string;
}[] = [
  {
    id: "spl",
    title: "SPL coin",
    headline: "Leftover SPL label",
    body: "OrbitX prints on Arc only. This venue label remains for leftover Stories.",
  },
  {
    id: "nft",
    title: "NFT",
    headline: "1/1 or editions",
    body: "Leftover NFT Stories. OrbitX prints on Arc only.",
  },
  {
    id: "pumpfun",
    title: "PumpSwap pair",
    headline: "Leftover PumpSwap label",
    body: "OrbitX prints on Arc only. This venue label remains for leftover Stories.",
  },
  {
    id: "pons",
    title: "Pons pair",
    headline: "Leftover Pons label",
    body: "OrbitX prints on Arc only. This venue label remains for leftover Stories.",
  },
];

export function findChain(id: string | null | undefined): ChainCard | undefined {
  if (!id) return undefined;
  return CHAINS.find((chain) => chain.id === id);
}

export function isPrintableChain(id: string | null | undefined): id is PrintableChain {
  return Boolean(id && (PRINTABLE_CHAIN_IDS as readonly string[]).includes(id));
}

export function isLaunchChain(id: string | null | undefined): id is LaunchChain {
  return Boolean(id && CHAINS.some((chain) => chain.id === id));
}
