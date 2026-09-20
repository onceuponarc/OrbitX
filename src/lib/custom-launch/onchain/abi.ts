export const FACTORY_ABI = [
  {
    type: "function",
    name: "createLaunch",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "uri", type: "string" },
          { name: "decimals", type: "uint8" },
          { name: "supply", type: "uint256" },
          { name: "quote", type: "address" },
          { name: "tradeFeeBps", type: "uint16" },
          { name: "splitBps", type: "uint16[9]" },
          { name: "protocol", type: "address" },
          { name: "creator", type: "address" },
          { name: "charity", type: "address" },
          { name: "treasury", type: "address" },
          { name: "community", type: "address" },
          { name: "tokenLiquidity", type: "uint256" },
          { name: "quoteLiquidity", type: "uint256" },
          { name: "maxExecution", type: "uint256" },
          { name: "cooldown", type: "uint32" },
          { name: "flywheel", type: "uint8[]" },
        ],
      },
    ],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "hubAddr", type: "address" },
      { name: "tokenAddr", type: "address" },
      { name: "poolAddr", type: "address" },
      { name: "routerAddr", type: "address" },
    ],
  },
  {
    type: "event",
    name: "LaunchCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "hub", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "pool", type: "address", indexed: false },
      { name: "router", type: "address", indexed: false },
      { name: "tradeFeeBps", type: "uint16", indexed: false },
    ],
  },
] as const;

export const HUB_ABI = [
  { type: "function", name: "execute", stateMutability: "nonpayable", inputs: [
    { name: "execId", type: "bytes32" }, { name: "action", type: "uint8" },
    { name: "amount", type: "uint256" }, { name: "minOut", type: "uint256" },
  ], outputs: [{ name: "received", type: "uint256" }] },
  { type: "function", name: "executeHolders", stateMutability: "nonpayable", inputs: [
    { name: "execId", type: "bytes32" }, { name: "recipients", type: "address[]" },
    { name: "amounts", type: "uint256[]" }, { name: "inToken", type: "bool" },
  ], outputs: [] },
  { type: "function", name: "balances", stateMutability: "view", inputs: [
    { name: "dest", type: "uint8" }, { name: "asset", type: "address" },
  ], outputs: [{ type: "uint256" }] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "creator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "armCurve", stateMutability: "nonpayable", inputs: [{ name: "creator_", type: "address" }], outputs: [] },
  { type: "function", name: "curveFill", stateMutability: "nonpayable", inputs: [
    { name: "trader", type: "address" }, { name: "quoteIn", type: "bool" },
    { name: "amountIn", type: "uint256" }, { name: "amountOut", type: "uint256" },
  ], outputs: [] },
  { type: "function", name: "graduatePool", stateMutability: "nonpayable", inputs: [
    { name: "tokenAmt", type: "uint256" }, { name: "quoteAmt", type: "uint256" }, { name: "minUnits", type: "uint256" },
  ], outputs: [{ name: "units", type: "uint256" }] },
] as const;

export const ROUTER_ABI = [
  { type: "function", name: "harvestAll", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "harvest", stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }], outputs: [] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const TOKEN_ABI = [
  ...ERC20_ABI,
  { type: "function", name: "burned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const POOL_ABI = [
  { type: "function", name: "reserveToken", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "reserveQuote", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "addLiquidity", stateMutability: "nonpayable", inputs: [
    { name: "tokenIn", type: "uint256" }, { name: "quoteIn", type: "uint256" }, { name: "minUnits", type: "uint256" },
  ], outputs: [{ type: "uint256" }] },
] as const;

export const ACTION_TO_ID: Record<string, number> = {
  buyback: 1,
  burn: 2,
  buyback_burn: 3,
  add_liquidity: 4,
  charity: 5,
  treasury: 6,
  community: 7,
  creator_claim: 8,
  holders: 9,
  flywheel: 10,
  claim_fees: 0,
};

export const DEST_INDEX = {
  orbitx: 0,
  creator: 1,
  holders: 2,
  liquidity: 3,
  buyback: 4,
  burn: 5,
  charity: 6,
  treasury: 7,
  community: 8,
} as const;
