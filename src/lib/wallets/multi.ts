import "server-only";

import { privateKeyToAccount } from "viem/accounts";
import { createServiceClient } from "@/lib/supabase/service";
import { encodeSecret, decodeSecret, sealKeypair } from "@/lib/solana/keys";
import { sealSecret, openSecret } from "@/lib/crypto/secret-box";
import { ETHEREUM, ROBINHOOD_CHAIN } from "@onceupon/config/solana";
import { packDeskSecret, unpackDeskSecret, looksLikeMnemonic } from "@/lib/wallets/desk-secret";
import {
  assertMnemonic,
  createEvmDeskWallet,
  createSolanaDeskWallet,
  entropyPhraseFromBytes,
  entropyPhraseFromEvmSecret,
  evmPrivateKeyFromEntropyPhrase,
  evmPrivateKeyFromMnemonic,
  mnemonicWordCount,
  solanaKeypairFromEntropyPhrase,
  solanaKeypairFromMnemonic,
} from "@/lib/wallets/mnemonic";

export type DeskChain = "solana" | "eth" | "rh";

function evmInsert(chain: DeskChain, userId: string, address: string, pk: string, mnemonic?: string | null) {
  return {
    user_id: userId,
    chain,
    address,
    ciphertext: sealSecret(packDeskSecret(pk, mnemonic)),
  };
}

export async function ensureDeskWallets(userId: string) {
  const service = createServiceClient();
  const { data: rows } = await service.from("wallet_secrets").select("chain,address").eq("user_id", userId);
  const have = new Set((rows ?? []).map((row) => row.chain as string));
  const created: DeskChain[] = [];

  if (!have.has("solana")) {
    const built = createSolanaDeskWallet();
    await service.from("wallet_secrets").insert({
      user_id: userId,
      chain: "solana",
      address: built.address,
      ciphertext: sealSecret(packDeskSecret(encodeSecret(built.keypair), built.mnemonic)),
    });
    created.push("solana");
  }

  for (const chain of ["eth", "rh"] as const) {
    if (have.has(chain)) continue;
    const built = createEvmDeskWallet();
    await service.from("wallet_secrets").insert(evmInsert(chain, userId, built.address, built.privateKey, built.mnemonic));
    created.push(chain);
  }

  return listDeskWallets(userId, created);
}

export async function listDeskWallets(userId: string, created: DeskChain[] = []) {
  const service = createServiceClient();
  const { data } = await service.from("wallet_secrets").select("chain,address").eq("user_id", userId);
  const rows = data ?? [];
  return {
    created,
    wallets: {
      solana: rows.find((row) => row.chain === "solana")?.address ?? null,
      eth: rows.find((row) => row.chain === "eth")?.address ?? null,
      rh: rows.find((row) => row.chain === "rh")?.address ?? null,
      arc: rows.find((row) => row.chain === "eth")?.address ?? null,
    },
    explorers: {
      solana: rows.find((row) => row.chain === "solana")?.address
        ? `https://solscan.io/account/${rows.find((row) => row.chain === "solana")?.address}`
        : null,
      eth: rows.find((row) => row.chain === "eth")?.address
        ? `${ETHEREUM.explorer}/address/${rows.find((row) => row.chain === "eth")?.address}`
        : null,
      rh: rows.find((row) => row.chain === "rh")?.address
        ? `${ROBINHOOD_CHAIN.explorer}/address/${rows.find((row) => row.chain === "rh")?.address}`
        : null,
    },
  };
}

export async function exportDeskSecret(userId: string, chain: DeskChain) {
  const service = createServiceClient();
  const { data } = await service
    .from("wallet_secrets")
    .select("address,ciphertext")
    .eq("user_id", userId)
    .eq("chain", chain)
    .maybeSingle();
  if (!data?.ciphertext || !data.address) throw new Error("No wallet on that chain.");
  let payload = unpackDeskSecret(openSecret(data.ciphertext));
  if (!payload.mnemonic) {
    const mnemonic =
      chain === "solana"
        ? entropyPhraseFromBytes(decodeSecret(payload.secret).secretKey.slice(0, 32))
        : entropyPhraseFromEvmSecret(payload.secret);
    payload = { secret: payload.secret, mnemonic };
    // Best-effort cache. Signing also calls this path; supabase errors stay in the result.
    await service
      .from("wallet_secrets")
      .update({ ciphertext: sealSecret(packDeskSecret(payload.secret, mnemonic)) })
      .eq("user_id", userId)
      .eq("chain", chain);
  }
  const secret = chain === "solana" ? encodeSecret(decodeSecret(payload.secret)) : payload.secret;
  return {
    address: data.address,
    secret,
    mnemonic: payload.mnemonic,
    phraseKind: mnemonicWordCount(payload.mnemonic ?? "") === 12 ? ("hd" as const) : ("words" as const),
  };
}

export async function importDeskSecret(userId: string, chain: DeskChain, secret: string) {
  const service = createServiceClient();
  const trimmed = secret.trim();
  if (looksLikeMnemonic(trimmed)) {
    const mnemonic = assertMnemonic(trimmed);
    const rawWords = mnemonicWordCount(mnemonic) === 24;
    if (chain === "solana") {
      const keypair = rawWords ? solanaKeypairFromEntropyPhrase(mnemonic) : solanaKeypairFromMnemonic(mnemonic);
      const address = keypair.publicKey.toBase58();
      await service.from("wallet_secrets").upsert(
        {
          user_id: userId,
          chain,
          address,
          ciphertext: sealSecret(packDeskSecret(encodeSecret(keypair), mnemonic)),
        },
        { onConflict: "user_id,chain" },
      );
      return { address };
    }
    const pk = rawWords ? evmPrivateKeyFromEntropyPhrase(mnemonic) : evmPrivateKeyFromMnemonic(mnemonic);
    const account = privateKeyToAccount(pk);
    await service.from("wallet_secrets").upsert(
      evmInsert(chain, userId, account.address, pk, mnemonic),
      { onConflict: "user_id,chain" },
    );
    return { address: account.address };
  }
  if (chain === "solana") {
    const keypair = decodeSecret(trimmed);
    const address = keypair.publicKey.toBase58();
    await service.from("wallet_secrets").upsert(
      { user_id: userId, chain, address, ciphertext: sealKeypair(keypair) },
      { onConflict: "user_id,chain" },
    );
    return { address };
  }
  const pk = (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
  const account = privateKeyToAccount(pk);
  await service.from("wallet_secrets").upsert(
    evmInsert(chain, userId, account.address, pk),
    { onConflict: "user_id,chain" },
  );
  return { address: account.address };
}
