"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readApiJson } from "@/lib/http/read-json";

export function AgentCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await readApiJson<{ error?: string; ok?: boolean }>(res);
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Agent sign-in failed.");
      router.push("/wallet");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-2 border-t border-white/10 pt-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Agent desk</p>
      <Input
        type="password"
        autoComplete="off"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Agent code"
        aria-label="Agent code"
      />
      <Button type="submit" variant="outline" className="w-full" disabled={busy || !code.trim()}>
        {busy ? "Signing in…" : "Enter with agent code"}
      </Button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </form>
  );
}
