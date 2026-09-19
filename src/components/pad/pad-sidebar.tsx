"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { DESKTOP_NAV, navActive } from "@/components/pad/nav";
import { cn } from "@/lib/utils";

export function PadSidebar({ onlineCount }: { onlineCount: number }) {
  const pathname = usePathname() ?? "/";

  return (
    <aside className="pad-sidebar hidden h-dvh w-[232px] shrink-0 flex-col border-r border-white/8 bg-[#0b0d12]/95 lg:sticky lg:top-0 lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <BrandMark className="size-9 rounded-xl border border-gold/20" />
        <span className="text-lg font-semibold tracking-tight text-white">
          Orbit<span className="text-gold">X</span>
        </span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {DESKTOP_NAV.map((group) => (
          <div key={group.group} className="mb-5">
            <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">{group.group}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const on = navActive(pathname, item.href, item.match);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-xl px-3 py-2 text-sm transition-colors",
                      on ? "bg-gold text-ink font-semibold" : "text-white/60 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <p className="px-5 pb-5 font-mono text-[11px] text-white/30">{onlineCount} desks live</p>
    </aside>
  );
}
