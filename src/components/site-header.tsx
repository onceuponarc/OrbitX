"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { SignInButton } from "@/components/sign-in-button";
import { NetworkChip } from "@/components/arc/network-chip";
import { BrandMark } from "@/components/brand-mark";
import { LiveTape } from "@/components/pad/live-tape";
import { ChainStatusBanner } from "@/components/pad/chain-status-banner";
import type { OrbitXer } from "@/lib/auth";

export function SiteHeader({
  profile,
}: {
  profile: OrbitXer | null;
}) {
  const pathname = usePathname() ?? "/";
  const home = pathname === "/";

  return (
    <header className="glass-nav sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between gap-3 px-3 lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <BrandMark className="size-8 rounded-xl border border-gold/20" />
          <span className="text-base font-semibold tracking-tight text-white">
            Orbit<span className="text-gold">X</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/trade"
            aria-label="Search and trade"
            className="flex size-9 items-center justify-center rounded-full border border-white/10 text-white/70"
          >
            <Search className="size-4" />
          </Link>
          <SignInButton profile={profile} compact />
        </div>
      </div>

      <div className="hidden h-14 items-center justify-between gap-4 px-6 lg:flex">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
            {home ? "Live pad" : "OrbitX desk"}
          </p>
          <p className="truncate text-sm text-white/70">Launch, trade, graduate — in-app wallet on every chain.</p>
        </div>
        <div className="flex items-center gap-2">
          <NetworkChip />
          <SignInButton profile={profile} />
        </div>
      </div>
      <LiveTape compact />
      <ChainStatusBanner />
    </header>
  );
}
