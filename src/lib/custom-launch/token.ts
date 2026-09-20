export type TokenLink = {
  label: string;
  url: string;
};

export const MINT_STANDARDS = ["spl", "token2022"] as const;
export type MintStandard = (typeof MINT_STANDARDS)[number];

export type TokenConfig = {
  name: string;
  symbol: string;
  supply: string;
  decimals: number;
  standard: MintStandard;
  description: string;
  imageUrl: string;
  bannerUrl: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  extraLinks: TokenLink[];
};

export type TokenFieldError = {
  name?: string;
  symbol?: string;
  supply?: string;
  decimals?: string;
  imageUrl?: string;
  bannerUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  extraLinks?: string;
  standard?: string;
};

export function createTokenConfig(decimals: number): TokenConfig {
  return {
    name: "",
    symbol: "",
    supply: "1000000000",
    decimals,
    standard: "token2022",
    description: "",
    imageUrl: "",
    bannerUrl: "",
    website: "",
    twitter: "",
    telegram: "",
    discord: "",
    extraLinks: [],
  };
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isDataImage(value: string) {
  return value.startsWith("data:image/");
}

export function isImageValue(value: string) {
  return isHttpUrl(value) || isDataImage(value);
}

export function isTwitterValue(value: string) {
  if (!value) return true;
  if (value.startsWith("@") && /^@[A-Za-z0-9_]{1,15}$/.test(value)) return true;
  return isHttpUrl(value) || /^[A-Za-z0-9_]{1,15}$/.test(value);
}

export function formatSupply(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "0";
  try {
    return BigInt(digits).toLocaleString("en-US");
  } catch {
    return digits;
  }
}

export function parseSupply(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return 0n;
  try {
    return BigInt(digits);
  } catch {
    return 0n;
  }
}

export function validateTokenConfig(token: TokenConfig): TokenFieldError {
  const errors: TokenFieldError = {};
  const name = token.name.trim();
  if (!name) errors.name = "Token name is required.";
  else if (name.length > 32) errors.name = "Name must be 32 characters or fewer.";

  const symbol = token.symbol.trim().toUpperCase();
  if (!symbol) errors.symbol = "Symbol is required.";
  else if (!/^[A-Z0-9]{2,12}$/.test(symbol)) errors.symbol = "Use 2–12 letters or numbers.";

  const supply = parseSupply(token.supply);
  if (supply <= 0n) errors.supply = "Supply must be a positive integer.";
  else if (supply > 1_000_000_000_000_000n) errors.supply = "Supply is above the mock ceiling.";

  if (!Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 18) {
    errors.decimals = "Decimals must be an integer from 0 to 18.";
  }
  if (token.standard !== "spl" && token.standard !== "token2022") {
    errors.decimals = errors.decimals ?? "Choose SPL or Token-2022.";
  }

  if (!token.imageUrl.trim()) errors.imageUrl = "Add a token image URL or local preview.";
  else if (!isImageValue(token.imageUrl)) errors.imageUrl = "Image must be an http(s) or data URL.";

  if (token.bannerUrl.trim() && !isImageValue(token.bannerUrl)) {
    errors.bannerUrl = "Banner must be an http(s) or data URL.";
  }
  if (token.website.trim() && !isHttpUrl(token.website)) errors.website = "Website must be an http(s) URL.";
  if (token.twitter.trim() && !isTwitterValue(token.twitter)) errors.twitter = "Use @handle or an X URL.";
  if (token.telegram.trim() && !isHttpUrl(token.telegram) && !token.telegram.includes("t.me/")) {
    errors.telegram = "Use a t.me link or http(s) URL.";
  }
  if (token.discord.trim() && !isHttpUrl(token.discord)) errors.discord = "Discord must be an http(s) URL.";
  if (token.extraLinks.some((link) => (link.label || link.url) && (!link.label.trim() || !isHttpUrl(link.url)))) {
    errors.extraLinks = "Each extra link needs a label and http(s) URL.";
  }
  return errors;
}

export function tokenConfigComplete(token: TokenConfig) {
  return Object.keys(validateTokenConfig(token)).length === 0;
}

export function isMintStandard(value: unknown): value is MintStandard {
  return value === "spl" || value === "token2022";
}
