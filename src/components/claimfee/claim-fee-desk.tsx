"use client";

import { useState } from "react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { SolanaConnectButton } from "@/components/wallet/connect-button";
import { useSolanaWallet } from "@/components/wallet/solana-wallet-provider";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function ClaimFeeDesk() {
  const { address, signTransaction, wallets } = useSolanaWallet();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jupiterDetected = wallets.some((wallet) => wallet.id === "jupiter");

  async function claim() {
    if (!address) {
      setError("Connect the wallet that created your Pump.fun coins first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const builtResponse = await fetch("/api/solana/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: address }),
      });
      const built = (await builtResponse.json()) as { transaction?: string; error?: string };
      if (!builtResponse.ok || !built.transaction) throw new Error(built.error ?? "Could not build the claim transaction.");

      const transaction = VersionedTransaction.deserialize(Buffer.from(built.transaction, "base64"));
      const signed = (await signTransaction(transaction)) as VersionedTransaction;
      const connection = new Connection(RPC, "confirmed");
      const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction(signature, "confirmed");
      setMessage(`Claim submitted successfully: ${signature}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The wallet rejected or could not submit the claim.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">Solana · Pump.fun</p>
          <h2 className="mt-2 text-xl font-semibold">Creator fee sweep</h2>
        </div>
        <SolanaConnectButton />
      </div>
      <div className="mt-6 space-y-3 text-sm text-white/60">
        {address ? (
          <p>Connected wallet: <span className="font-mono text-white">{short(address)}</span></p>
        ) : (
          <p>Connect the creator wallet to inspect and claim its accrued fees.</p>
        )}
        <p>
          Pump.fun’s official creator-fee collection transaction handles the eligible creator vaults. Your wallet
          reviews and signs it locally; OrbitX does not custody funds or private keys.
        </p>
        {jupiterDetected ? <p className="text-emerald-300">Jupiter Wallet detected.</p> : null}
      </div>
      <Button type="button" className="mt-6" onClick={() => void claim()} disabled={!address || busy}>
        {busy ? "Building and submitting…" : "Claim all creator fees"}
      </Button>
      {message ? <p className="mt-4 break-all text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-4 break-words text-xs text-red-300">{error}</p> : null}
      <p className="mt-6 text-[11px] leading-5 text-white/35">
        Network fees are paid by the connected wallet. Only sign a transaction you initiated from this page.
      </p>
    </section>
  );
}
