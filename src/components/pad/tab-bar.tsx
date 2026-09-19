"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Home, Rocket, UserRound, Wallet } from "lucide-react";
import { APP_TABS, navActive } from "@/components/pad/nav";
import { cn } from "@/lib/utils";

const ICONS = {
  "/": Home,
  "/trade": ArrowLeftRight,
  "/launch": Rocket,
  "/wallet": Wallet,
  "/you": UserRound,
} as const;

export function TabBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary"
      className="glass-tab fixed inset-x-0 bottom-0 z-50 border-t border-white/8 lg:hidden"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid h-[4.15rem] max-w-lg grid-cols-5 items-end px-1">
        {APP_TABS.map((tab) => {
          const Icon = ICONS[tab.href];
          const on = navActive(pathname, tab.href, tab.match);
          const launch = "primary" in tab && tab.primary;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-end gap-0.5 pb-1.5 text-[10px] font-semibold tracking-wide",
                on || launch ? "text-gold" : "text-white/40",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-2xl transition",
                  launch
                    ? "mb-0.5 size-12 -translate-y-2 bg-gold text-ink shadow-[0_10px_28px_rgba(214,255,61,0.35)]"
                    : "size-8",
                  on && !launch && "bg-gold/12",
                )}
              >
                <Icon className={cn(launch ? "size-5" : "size-5")} strokeWidth={2.15} />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
