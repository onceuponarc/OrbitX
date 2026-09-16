import Link from "next/link";
const COLS = [
  {
    title: "Desk",
    links: [
      { href: "/", label: "Board" },
      { href: "/launch", label: "Launch" },
      { href: "/cards", label: "Cards" },
      { href: "/drop", label: "Drop" },
    ],
  },
  {
    title: "Trade",
    links: [
      { href: "/wallet", label: "Wallet" },
      { href: "/week", label: "Week" },
      { href: "/you", label: "You" },
      { href: "/tools", label: "Tools" },
    ],
  },
  {
    title: "Official",
    links: [
      { href: "/params", label: "$ORBITX live" },
      { href: "/links", label: "Links" },
      { href: "https://x.com/orbitx_wrld", label: "X" },
      { href: "https://www.orbitxtrade.world/", label: "Updates" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/whitepaper", label: "Whitepaper" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-4 pb-28 pt-10 text-center lg:pb-12">
      <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col items-center">
          <p className="text-lg font-semibold">OrbitX</p>
          <p className="mt-2 max-w-xs text-sm text-white/45">
            Multi-chain launchpad — Solana, Arc, and Robinhood Chain. Every launch signs from your in-app desk
            wallet. Press Cards mint as real on-chain NFTs. Official token CA only from official channels.
          </p>
          <Link
            href="/params"
            className="mt-4 block w-full max-w-xs rounded-xl border border-arc/20 bg-arc/[0.05] px-3 py-2 hover:border-arc/40"
          >
            <p className="text-xs font-medium text-arc">Official token · $ORBITX live</p>
            <p className="mt-1 font-mono text-[11px] text-white/45">Verified through official channels</p>
          </Link>
        </div>
        {COLS.map((col) => (
          <div key={col.title} className="flex flex-col items-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white"
                    {...(link.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
