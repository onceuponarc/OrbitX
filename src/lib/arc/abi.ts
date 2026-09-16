export const erc20Abi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  // Added for OrbitX revenue collection on Arc: the fee is an ERC-20 transfer of
  // the quote asset (USDC) to the Arc revenue wallet.
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const factoryAbi = [
  {
    type: "function",
    name: "createStory",
    stateMutability: "payable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "uri", type: "string" },
          { name: "quote", type: "address" },
          { name: "engine", type: "uint8" },
          { name: "authorBps", type: "uint16" },
          { name: "protocolBps", type: "uint16" },
          { name: "pieceBps", type: "uint16" },
          { name: "graduateQuoteTarget", type: "uint256" },
          { name: "feeRecipient", type: "address" },
          { name: "seedQuote", type: "uint256" },
          { name: "minBaseOut", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "storyId", type: "bytes32" },
      { name: "curveAddr", type: "address" },
      { name: "tokenAddr", type: "address" },
    ],
  },
  {
    type: "function",
    name: "setQuote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "quote", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export const curveAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "quoteIn", type: "uint256" },
      { name: "minBaseOut", type: "uint256" },
    ],
    outputs: [{ name: "baseOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "baseIn", type: "uint256" },
      { name: "minQuoteOut", type: "uint256" },
    ],
    outputs: [{ name: "quoteOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteBuy",
    stateMutability: "view",
    inputs: [
      { name: "", type: "bytes32" },
      { name: "quoteIn", type: "uint256" },
    ],
    outputs: [
      { name: "baseOut", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "priceAfter", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "quoteSell",
    stateMutability: "view",
    inputs: [
      { name: "", type: "bytes32" },
      { name: "baseIn", type: "uint256" },
    ],
    outputs: [
      { name: "quoteOut", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "priceAfter", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "snapshot",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "graduated_", type: "bool" },
      { name: "virtualQuote_", type: "uint256" },
      { name: "virtualBase_", type: "uint256" },
      { name: "realQuote_", type: "uint256" },
      { name: "realBase_", type: "uint256" },
      { name: "k_", type: "uint256" },
      { name: "graduateQuoteTarget_", type: "uint256" },
      { name: "lpBaseReserved_", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "progress",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "realQuote", type: "uint256" },
      { name: "target", type: "uint256" },
      { name: "bpsToGrad", type: "uint16" },
    ],
  },
] as const;
