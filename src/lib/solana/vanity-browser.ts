import bs58 from "bs58";
import { mintEndsWith } from "./vanity";

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Browser-side grind so a …obx mint is often ready before the user hits Launch. */
export async function mineVanitySecretBrowser(suffix: string, signal: AbortSignal): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.generateKey) return null;
  try {
    while (!signal.aborted) {
      const pair = (await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
      const rawPub = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
      if (!mintEndsWith(bs58.encode(rawPub), suffix)) continue;
      const jwk = await subtle.exportKey("jwk", pair.privateKey);
      if (!jwk.d) continue;
      const seed = base64UrlToBytes(jwk.d);
      if (seed.byteLength !== 32 || rawPub.byteLength !== 32) continue;
      const secret = new Uint8Array(64);
      secret.set(seed, 0);
      secret.set(rawPub, 32);
      return bytesToBase64(secret);
    }
  } catch {
    return null;
  }
  return null;
}
