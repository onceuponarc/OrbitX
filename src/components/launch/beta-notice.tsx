export function BetaNotice({ chain }: { chain: "arc" }) {
  void chain;
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100/90">
      <p className="font-medium text-amber-300">Beta — Arc launches aren&apos;t fully tested yet</p>
      <p className="mt-1 text-amber-100/70">
        Solana and Robinhood Chain are live end to end. Arc is still in beta; we can&apos;t guarantee everything
        works correctly right now. The team is testing this fully this week.
      </p>
    </div>
  );
}

export function RiskFeeNotice({ variant = "launch" }: { variant?: "launch" | "trade" }) {
  if (variant === "trade") {
    return (
      <div className="rounded-2xl border border-white/10 px-4 py-3 text-xs leading-relaxed text-white/45">
        This isn&apos;t financial advice. Any token can go to $0 — only risk what you&apos;re willing to lose.
        Network and swap fees for a trade are shown live in the quote above before you confirm.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 px-4 py-3 text-xs leading-relaxed text-white/45">
      This isn&apos;t financial advice. Any token can go to $0 — only risk what you&apos;re willing to lose.
      Launches and NFT card mints both include an on-chain fee of roughly $0.60 to cover the cost of minting
      on-chain — that goes to the network, not to OrbitX.
    </div>
  );
}
