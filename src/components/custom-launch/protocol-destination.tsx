"use client";

import { useState } from "react";
import { ORBITX_PROTOCOL, shortenOrbitxDestination } from "@/lib/custom-launch/protocol";
import { formatBps } from "@/lib/custom-launch/schema";

export function ProtocolDestination() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(ORBITX_PROTOCOL.destination);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="ox-console rounded-[1.35rem] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">OrbitX Protocol</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight">Locked protocol allocation</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        A portion of Custom Launch trading fees is reserved for the OrbitX protocol. The destination
        cannot be edited here. This is a mock desk value until contracts bind.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Destination</p>
          <p className="mt-1 font-mono text-sm" title={ORBITX_PROTOCOL.destination}>
            {shortenOrbitxDestination()}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Share</p>
          <p className="mt-1 text-lg font-semibold text-gold">{formatBps(ORBITX_PROTOCOL.allocationBps)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-3 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-white"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </section>
  );
}
