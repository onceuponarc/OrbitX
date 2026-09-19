import "server-only";

import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadArcNetwork } from "@/lib/arc/env";
import { arcChain } from "@/lib/arc/client";
import { exportDeskSecret, ensureDeskWallets } from "@/lib/wallets/multi";
import { loadUserKeypair } from "@/lib/wallets/embedded";
import { explorerFromSig, sendSignedTx, waitForTx } from "@/lib/solana/partial-tx";

export async function deskEvmWallet(userId: string) {
  await ensureDeskWallets(userId);
  const { secret } = await exportDeskSecret(userId, "eth");
  const pk = (secret.startsWith("0x") ? secret : `0x${secret}`) as `0x${string}`;
  const account = privateKeyToAccount(pk);
  const net = loadArcNetwork();
  if (!net) throw new Error("Arc RPC is not set.");
  const wallet = createWalletClient({
    account,
    chain: arcChain(net),
    transport: http(net.rpcUrl),
  });
  return { wallet, address: account.address, net };
}

export async function deskSolanaKey(userId: string) {
  await ensureDeskWallets(userId);
  return loadUserKeypair(userId);
}

function signDeskBytes(key: Awaited<ReturnType<typeof deskSolanaKey>>, bytes: Buffer, versioned: boolean | "auto") {
  if (versioned === true) {
    const tx = VersionedTransaction.deserialize(bytes);
    tx.sign([key]);
    return Buffer.from(tx.serialize()).toString("base64");
  }
  if (versioned === false) {
    const tx = Transaction.from(bytes);
    tx.partialSign(key);
    return tx.serialize().toString("base64");
  }
  try {
    const tx = VersionedTransaction.deserialize(bytes);
    tx.sign([key]);
    return Buffer.from(tx.serialize()).toString("base64");
  } catch {
    const tx = Transaction.from(bytes);
    tx.partialSign(key);
    return tx.serialize().toString("base64");
  }
}

/** Sign a desk-built Solana tx with the in-app key and land it. Never asks a browser wallet. */
export async function signAndSendDeskTx(
  userId: string,
  transactionBase64: string,
  versioned: boolean | "auto" = false,
  opts?: { confirmMs?: number },
) {
  const key = await deskSolanaKey(userId);
  const bytes = Buffer.from(transactionBase64, "base64");
  const signed = signDeskBytes(key, bytes, versioned);
  const signature = await sendSignedTx(signed);
  const confirmMs = opts?.confirmMs;
  if (confirmMs && confirmMs > 0) {
    const confirm = waitForTx(signature);
    const timedOut = await Promise.race([
      confirm.then(() => false),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(true), confirmMs);
      }),
    ]);
    if (timedOut) void confirm.catch(() => undefined);
    else await confirm;
  } else {
    await waitForTx(signature);
  }
  return { signature, explorer: explorerFromSig(signature), payer: key.publicKey.toBase58() };
}

export { exportDeskSecret };
