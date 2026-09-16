"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = { ready?: boolean; chainId?: number };

export function NetworkChip() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/arc/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Arc unavailable"))))
      .then((value: Status) => setStatus(value))
      .catch(() => setStatus({ ready: false }));
  }, []);
  const live = Boolean(status?.ready && status.chainId === 5042);
  return (
    <div className={cn("flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]", live ? "border-white/20 text-white/70" : "border-white/10 text-white/35")}>
      <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-400" : "bg-white/25")} />
      Arc mainnet
    </div>
  );
}
