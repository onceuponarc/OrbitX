"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MARKET_EVENT } from "@/lib/live-market";

/** Soft poll for pad stats. Must never stack with a click/navigation — a
 *  2s `router.refresh()` on the home RSC is what made tabs feel frozen. */
export function LiveRefresh({ intervalMs = 12_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let inflight = false;
    let quietUntil = 0;
    let cooldown: number | null = null;

    function quiet(ms = 2_400) {
      quietUntil = Math.max(quietUntil, Date.now() + ms);
    }

    function tick() {
      if (inflight) return;
      if (document.visibilityState !== "visible") return;
      if (Date.now() < quietUntil) return;
      inflight = true;
      router.refresh();
      cooldown = window.setTimeout(() => {
        inflight = false;
        cooldown = null;
      }, 1_500);
    }

    const timer = window.setInterval(tick, intervalMs);
    const onPointer = () => quiet(2_800);
    const onMarket = () => {
      if (Date.now() < quietUntil) return;
      tick();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") quiet(intervalMs);
    };

    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onPointer, true);
    window.addEventListener("popstate", onPointer);
    window.addEventListener(MARKET_EVENT, onMarket);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      if (cooldown != null) window.clearTimeout(cooldown);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onPointer, true);
      window.removeEventListener("popstate", onPointer);
      window.removeEventListener(MARKET_EVENT, onMarket);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, router, pathname]);

  return null;
}
