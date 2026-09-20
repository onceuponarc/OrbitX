export type HolderLine = { address: string; amount: string };

export function parseHolderLines(text: string): HolderLine[] {
  const rows: HolderLine[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Holder line must be "address amount". Got: ${line}`);
    }
    const address = parts[0];
    const amount = parts[1].replace(/[^\d]/g, "");
    if (!address || !amount || amount === "0") {
      throw new Error(`Holder line needs a wallet and a positive raw amount. Got: ${line}`);
    }
    rows.push({ address, amount });
  }
  return rows;
}
