import Link from "next/link";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";

const COLS = [
  {
    title: "Pad",
    links: [
      { href: "/", label: "Board" },
      { href: "/launch", label: "Launch" },
      { href: "/trade", label: "Trade" },
      { href: "/wallet", label: "Wallet" },
    ],
  },
  {
    title: "Create",
    links: [
      { href: "/drop", label: "Drop" },
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
      { href: `${PUBLIC_SITE_URL}/`, label: "Launchpad" },
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
    <footer className="hidden border-t border-white/8 px-8 py-10 lg:block">
      <div className="grid gap-8 lg:grid-cols-5">
        <div>
          <p className="text-lg font-semibold tracking-tight">
            Orbit<span className="text-gold">X</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-white/45">
            Multi-chain launchpad. Solana, Arc, and Robinhood Chain. Every launch signs from your in-app desk.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-gold"
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
