const PUMP_LOCAL = "https://pumpportal.fun/api/trade-local";

export async function pumpCreateTx(input: {
  publicKey: string;
  name: string;
  symbol: string;
  metadataUri: string;
  mint: string;
  devBuySol: number;
}) {
  const res = await fetch(PUMP_LOCAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: input.publicKey,
      action: "create",
      tokenMetadata: {
        name: input.name,
        symbol: input.symbol,
        uri: input.metadataUri,
      },
      mint: input.mint,
      denominatedInSol: "true",
      amount: input.devBuySol,
      slippage: 15,
      priorityFee: 0.0005,
      pool: "pump",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Pump.fun would not build the create tx.");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

export async function pumpCollectFeeTx(publicKey: string) {
  const res = await fetch(PUMP_LOCAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey,
      action: "collectCreatorFee",
      priorityFee: 0.0002,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Could not build the fee-claim tx.");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const asText = buf.toString("utf8").trim();
  if (asText.startsWith("{") || asText.startsWith("[")) {
    throw new Error(asText.slice(0, 280) || "Could not build the fee-claim tx.");
  }
  return buf.toString("base64");
}
