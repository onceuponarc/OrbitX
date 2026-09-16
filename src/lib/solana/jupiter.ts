import "server-only";

const BASE = "https://lite-api.jup.ag/swap/v1";

export type JupiterQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan?: { swapInfo: { label: string } }[];
};

export async function getJupiterQuote(opts: {
  inputMint: string;
  outputMint: string;
  amountRaw: string;
  slippageBps: number;
}): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint: opts.inputMint,
    outputMint: opts.outputMint,
    amount: opts.amountRaw,
    slippageBps: String(opts.slippageBps),
  });
  const res = await fetch(`${BASE}/quote?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Jupiter couldn't quote that pair right now.");
  }
  return res.json();
}

export async function getJupiterSwapTx(quote: JupiterQuote, userPublicKey: string): Promise<string> {
  const res = await fetch(`${BASE}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Jupiter couldn't build that swap right now.");
  }
  const body = (await res.json()) as { swapTransaction?: string };
  if (!body.swapTransaction) throw new Error("Jupiter returned no transaction.");
  return body.swapTransaction;
}

export type JupiterRawInstruction = {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
};

export type JupiterSwapInstructions = {
  tokenLedgerInstruction?: JupiterRawInstruction;
  computeBudgetInstructions: JupiterRawInstruction[];
  setupInstructions: JupiterRawInstruction[];
  swapInstruction: JupiterRawInstruction;
  cleanupInstruction?: JupiterRawInstruction;
  addressLookupTableAddresses: string[];
};

/**
 * Instruction-level variant of the swap build. Returns the individual
 * instructions instead of a finished transaction so the caller can splice the
 * OrbitX revenue-fee transfer into the SAME transaction as the swap — the fee
 * must not be a separate transaction that can succeed while the trade fails.
 */
export async function getJupiterSwapInstructions(
  quote: JupiterQuote,
  userPublicKey: string,
): Promise<JupiterSwapInstructions> {
  const res = await fetch(`${BASE}/swap-instructions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Jupiter couldn't build that swap right now.");
  }
  const body = (await res.json()) as JupiterSwapInstructions & { error?: string };
  if (body.error) throw new Error(body.error);
  if (!body.swapInstruction) throw new Error("Jupiter returned no swap instruction.");
  return body;
}

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
