export function DexScreenerEmbed({ chain, tokenAddress }: { chain: string; tokenAddress: string | null }) {
  if (!tokenAddress) return null;
  if (chain !== "solana") {
    const explorer =
      chain === "robinhood"
        ? `https://explorer.robinhood.com/address/${tokenAddress}`
        : chain === "arc"
          ? `https://www.geckoterminal.com/arc/tokens/${tokenAddress}`
          : `https://solscan.io/token/${tokenAddress}`;
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 text-sm text-white/50">
        <p>
          {chain === "arc"
            ? "DexScreener does not index Arc yet. Liquidity is the Argus Uniswap v4 USDC pool."
            : "DexScreener doesn't index this chain yet."}
        </p>
        <a href={explorer} target="_blank" rel="noreferrer" className="underline">
          {chain === "arc" ? "View on GeckoTerminal" : "View on the chain explorer"}
        </a>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <iframe
        title="DexScreener chart and live trades"
        src={`https://dexscreener.com/solana/${tokenAddress}?embed=1&theme=dark&trades=1&info=0`}
        className="h-[620px] w-full"
        loading="lazy"
      />
    </div>
  );
}
