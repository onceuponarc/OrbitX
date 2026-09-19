import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";
import { privateKeyToAccount } from "viem/accounts";
import { packDeskSecret, unpackDeskSecret, looksLikeMnemonic } from "../src/lib/wallets/desk-secret.ts";
import {
  createEvmDeskWallet,
  createSolanaDeskWallet,
  entropyPhraseFromBytes,
  entropyPhraseFromEvmSecret,
  evmPrivateKeyFromEntropyPhrase,
  evmPrivateKeyFromMnemonic,
  mnemonicWordCount,
  solanaKeypairFromEntropyPhrase,
  solanaKeypairFromMnemonic,
} from "../src/lib/wallets/mnemonic.ts";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

assert(!looksLikeMnemonic("0xabc"), "hex is not a phrase");
assert(looksLikeMnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"), "12 words");

const sol = createSolanaDeskWallet();
assert(mnemonicWordCount(sol.mnemonic) === 12, "new Solana desks use a 12-word HD phrase");
assert(solanaKeypairFromMnemonic(sol.mnemonic).publicKey.equals(sol.keypair.publicKey), "Solana HD roundtrip");

const evm = createEvmDeskWallet();
assert(mnemonicWordCount(evm.mnemonic) === 12, "new EVM desks use a 12-word HD phrase");
assert(evmPrivateKeyFromMnemonic(evm.mnemonic).toLowerCase() === evm.privateKey.toLowerCase(), "EVM HD key roundtrip");
assert(privateKeyToAccount(evm.privateKey).address === evm.address, "EVM address matches");

const packed = packDeskSecret(sol.address, sol.mnemonic);
const unpacked = unpackDeskSecret(packed);
assert(unpacked.mnemonic === sol.mnemonic, "v2 pack keeps the phrase");
assert(unpackDeskSecret("raw-secret").mnemonic === null, "legacy pack has no phrase");

const rawSol = Keypair.generate();
const wordBackup = entropyPhraseFromBytes(rawSol.secretKey.slice(0, 32));
assert(mnemonicWordCount(wordBackup) === 24, "legacy Solana backup is 24 words");
assert(solanaKeypairFromEntropyPhrase(wordBackup).publicKey.equals(rawSol.publicKey), "24-word backup restores the same Solana key");

const rawEvm = evm.privateKey;
const evmWords = entropyPhraseFromEvmSecret(rawEvm);
assert(mnemonicWordCount(evmWords) === 24, "legacy EVM backup is 24 words");
assert(evmPrivateKeyFromEntropyPhrase(evmWords).toLowerCase() === rawEvm.toLowerCase(), "24-word backup restores the same EVM key");

const desk = readFileSync(new URL("../src/components/wallet/desk.tsx", import.meta.url), "utf8");
assert(desk.includes("Copy recovery phrase"), "export UI must copy the phrase");
assert(desk.includes("Copy private key"), "export UI must copy the private key");
assert(desk.includes("Reveal key + phrase"), "export button must offer both formats");

console.log(JSON.stringify({ ok: true, solana: sol.address, evm: evm.address }));
