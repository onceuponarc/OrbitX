export function ChainStatusBanner() {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-t border-white/5 px-3 py-1.5 [scrollbar-width:none] lg:px-6">
      <span className="size-1.5 shrink-0 rounded-full bg-buy" />
      <span className="shrink-0 rounded-full bg-buy/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-buy">
        Solana live
      </span>
      <span className="shrink-0 rounded-full bg-buy/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-buy">
        Robinhood live
      </span>
      <span className="shrink-0 rounded-full bg-heat/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-heat">
        Arc beta
      </span>
    </div>
  );
}
