/** Sealed desk payload. Legacy rows are a raw secret string. v2 adds a BIP39 phrase. */

export type DeskSecretPayload = {
  secret: string;
  mnemonic: string | null;
};

export function packDeskSecret(secret: string, mnemonic?: string | null): string {
  if (!mnemonic?.trim()) return secret;
  return JSON.stringify({ v: 2, secret, mnemonic: mnemonic.trim() });
}

export function unpackDeskSecret(plain: string): DeskSecretPayload {
  const trimmed = plain.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { v?: number; secret?: unknown; mnemonic?: unknown };
      if (typeof parsed.secret === "string" && parsed.secret.length > 0) {
        return {
          secret: parsed.secret,
          mnemonic: typeof parsed.mnemonic === "string" && parsed.mnemonic.trim() ? parsed.mnemonic.trim() : null,
        };
      }
    } catch {
      /* fall through to raw secret */
    }
  }
  return { secret: plain, mnemonic: null };
}

export function looksLikeMnemonic(value: string): boolean {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length === 12 || words.length === 24;
}
