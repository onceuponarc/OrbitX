"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton } from "@/components/sign-in-button";
import { NetworkChip } from "@/components/arc/network-chip";
import { BrandMark } from "@/components/brand-mark";
import { LiveTape } from "@/components/pad/live-tape";
import { ChainStatusBanner } from "@/components/pad/chain-status-banner";
import type { OrbitXer } from "@/lib/auth";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/", label: "Board", match: "/" },
  { href: "/launch", label: "Launch", match: "/launch" },
  { href: "/trade", label: "Trade", match: "/trade" },
  { href: "/cards", label: "Cards", match: "/cards" },
  { href: "/drop", label: "Drop", match: "/drop" },
] as const;

const MORE = [
  { href: "/wallet", label: "Wallet" },
  { href: "/week", label: "Week" },
  { href: "/params", label: "Token" },
  { href: "/whitepaper", label: "Whitepaper" },
  { href: "/tools", label: "Tools" },
  { href: "/links", label: "Links" },
] as const;

function active(pathname: string, href: string, match?: string) {
  if (href === "/") return pathname === "/";
  const base = match ?? href;
  return pathname === href || pathname.startsWith(`${base}/`) || pathname === base;
}

export function SiteHeader({
  profile,
  onlineCount,
}: {
  profile: OrbitXer | null;
  onlineCount: number;
}) {
  const pathname = usePathname() ?? "/";

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <BrandMark className="size-8 rounded-md border border-white/15" />
          <span className="font-display text-xl text-white">OrbitX</span>
          <span className="hidden rounded-md border border-white/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 sm:inline">
            Arc
          </span>
        </Link>
        <nav className="hidden items-center justify-center gap-1 lg:flex">
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors",
                active(pathname, item.href, item.match)
                  ? "bg-white text-black"
                  : "text-white/55 hover:bg-white/5 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          {MORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-2.5 py-1.5 text-sm",
                active(pathname, item.href) ? "text-white" : "text-white/40 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-2">
          <p className="hidden font-mono text-[11px] text-white/35 xl:block">{onlineCount} desks</p>
          <NetworkChip />
          <SignInButton profile={profile} />
        </div>
      </div>
      <LiveTape compact />
      <ChainStatusBanner />
    </header>
  );
}
