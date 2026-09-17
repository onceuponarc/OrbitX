import { parseIpfsInput } from "./ipfs.ts";

const DEFAULT_CREATED_ON = "https://www.orbitxtrade.world";
const DEFAULT_IMAGE = `${DEFAULT_CREATED_ON}/brand/logo.jpg`;

/** Slim Metaplex / pump.fun off-chain JSON. Extra keys are ignored by their indexer. */
export type PumpTokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName: true;
  createdOn: string;
  twitter?: string;
  telegram?: string;
  website?: string;
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i;

/** Cover uploads (ipfs:// CID, gateway PNG, supabase image) must never be used as the on-chain metadata URI. */
export function looksLikeImageUri(uri: string | null | undefined): boolean {
  const value = (uri ?? "").trim();
  if (!value) return false;
  const path = value.split(/[?#]/)[0] ?? value;
  if (/\/api\/token\/[^/]+\/metadata\/?$/i.test(path)) return false;
  if (/\.json$/i.test(path)) return false;
  if (IMAGE_EXT.test(path)) return true;
  return Boolean(parseIpfsInput(value));
}

/** pump.fun / DexScreener fetch HTTP(S) images. Convert ipfs:// to a public gateway URL. */
export function httpImageUrl(
  imageUri?: string | null,
  coverUrl?: string | null,
  fallback = DEFAULT_IMAGE,
): string {
  for (const raw of [imageUri, coverUrl, fallback]) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    const ipfs = parseIpfsInput(value);
    if (ipfs) return ipfs.gatewayUrl;
    if (/^https?:\/\//i.test(value)) return value;
  }
  return fallback;
}

export function buildPumpTokenMetadata(input: {
  name: string;
  symbol: string;
  description: string;
  image?: string | null;
  createdOn?: string;
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
}): PumpTokenMetadata {
  const json: PumpTokenMetadata = {
    name: input.name.trim() || "OrbitX",
    symbol: input.symbol.trim().toUpperCase() || "ORBX",
    description: input.description.trim(),
    image: httpImageUrl(input.image, null, DEFAULT_IMAGE),
    showName: true,
    createdOn: input.createdOn?.trim() || DEFAULT_CREATED_ON,
  };
  const twitter = input.twitter?.trim();
  const telegram = input.telegram?.trim();
  const website = input.website?.trim();
  if (twitter) json.twitter = twitter;
  if (telegram) json.telegram = telegram;
  if (website) json.website = website;
  return json;
}

/** Prefer a pinned JSON CID. Never fall back to an image URI — pump.fun would then show no description or links. */
export function chooseMetadataUri(opts: {
  fallbackUri: string;
  pinnedGatewayUrl?: string | null;
  clientUri?: string | null;
}): string {
  const pinned = opts.pinnedGatewayUrl?.trim();
  if (pinned) return pinned;
  const client = opts.clientUri?.trim();
  if (client && !looksLikeImageUri(client)) return client;
  return opts.fallbackUri;
}
