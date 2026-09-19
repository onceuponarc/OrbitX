import { Keypair } from "@solana/web3.js";
import { entropyToMnemonic, generateMnemonic, mnemonicToEntropy, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { derivePath } from "ed25519-hd-key";
import { privateKeyToAccount } from "viem/accounts";
/** Phantom / Solflare / Backpack default account. */
export const SOLANA_PHANTOM_PATH = "m/44'/501'/0'/0'";
/** MetaMask / Rabby / Trust first account. */
export const EVM_DEFAULT_PATH = "m/44'/60'/0'/0/0";

export function createMnemonic(): string {
  return generateMnemonic(wordlist, 128);
}

export function normalizeMnemonic(value: string): string {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

export function assertMnemonic(value: string): string {
  const phrase = normalizeMnemonic(value);
  const words = phrase.split(" ");
  if ((words.length !== 12 && words.length !== 24) || !validateMnemonic(phrase, wordlist)) {
    throw new Error("That recovery phrase is not a valid 12 or 24 word backup.");
  }
  return phrase;
}

function seedHex(mnemonic: string): string {
  return Buffer.from(mnemonicToSeedSync(assertMnemonic(mnemonic))).toString("hex");
}

export function solanaKeypairFromMnemonic(mnemonic: string): Keypair {
  const { key } = derivePath(SOLANA_PHANTOM_PATH, seedHex(mnemonic));
  return Keypair.fromSeed(key);
}

export function evmPrivateKeyFromMnemonic(mnemonic: string): `0x${string}` {
  const seed = mnemonicToSeedSync(assertMnemonic(mnemonic));
  const child = HDKey.fromMasterSeed(seed).derive(EVM_DEFAULT_PATH);
  if (!child.privateKey) throw new Error("Could not derive an EVM key from that phrase.");
  return `0x${Buffer.from(child.privateKey).toString("hex")}`;
}

export function createSolanaDeskWallet() {
  const mnemonic = createMnemonic();
  const keypair = solanaKeypairFromMnemonic(mnemonic);
  return { mnemonic, keypair, address: keypair.publicKey.toBase58() };
}

export function createEvmDeskWallet() {
  const mnemonic = createMnemonic();
  const privateKey = evmPrivateKeyFromMnemonic(mnemonic);
  const account = privateKeyToAccount(privateKey);
  return { mnemonic, privateKey, address: account.address };
}

/** 24-word encoding of an existing raw key so older desks can export a phrase without changing the address. */
export function entropyPhraseFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 32) throw new Error("Word backup needs a 32-byte key.");
  return entropyToMnemonic(bytes, wordlist);
}

export function entropyPhraseFromEvmSecret(secret: string): string {
  const hex = secret.startsWith("0x") ? secret.slice(2) : secret;
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length !== 32) throw new Error("That EVM key is not 32 bytes.");
  return entropyToMnemonic(bytes, wordlist);
}

export function solanaKeypairFromEntropyPhrase(mnemonic: string): Keypair {
  const entropy = mnemonicToEntropy(assertMnemonic(mnemonic), wordlist);
  if (entropy.length !== 32) throw new Error("That phrase is not a 24-word raw-key backup.");
  return Keypair.fromSeed(entropy);
}

export function evmPrivateKeyFromEntropyPhrase(mnemonic: string): `0x${string}` {
  const entropy = mnemonicToEntropy(assertMnemonic(mnemonic), wordlist);
  if (entropy.length !== 32) throw new Error("That phrase is not a 24-word raw-key backup.");
  return `0x${Buffer.from(entropy).toString("hex")}`;
}

export function mnemonicWordCount(mnemonic: string): number {
  return normalizeMnemonic(mnemonic).split(" ").length;
}
