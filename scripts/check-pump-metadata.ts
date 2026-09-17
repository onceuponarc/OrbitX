import {
  buildPumpTokenMetadata,
  chooseMetadataUri,
  httpImageUrl,
  looksLikeImageUri,
} from "../src/lib/media/token-json.ts";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

assert(looksLikeImageUri("ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"), "bare ipfs cover is an image");
assert(looksLikeImageUri("https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"), "gateway cover is an image");
assert(looksLikeImageUri("https://cdn.example/cover.png"), "png is an image");
assert(looksLikeImageUri("https://cdn.example/art.WEBP?w=400"), "webp query is an image");
assert(!looksLikeImageUri("https://www.orbitxtrade.world/api/token/Mint111/metadata"), "orbitx metadata api is json");
assert(!looksLikeImageUri("https://ipfs.io/ipfs/bafybeigmetadata/metadata.json"), "json path is not an image");
assert(!looksLikeImageUri(""), "empty is not classified as image");

const image = httpImageUrl(
  "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "https://unused.example/cover.png",
);
assert(image === "https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG", `gateway image: ${image}`);

const json = buildPumpTokenMetadata({
  name: "Orbit Cat",
  symbol: "ocat",
  description: "A cat on the curve.\n\nLaunched on OrbitX. Author @alice.",
  image,
  twitter: "https://x.com/alice",
  telegram: "https://t.me/orbitcat",
  website: "https://orbit.cat",
});

assert(json.name === "Orbit Cat", "name");
assert(json.symbol === "OCAT", "symbol uppercased");
assert(json.showName === true, "showName");
assert(json.createdOn === "https://www.orbitxtrade.world", "createdOn");
assert(json.image === image, "image");
assert(json.twitter === "https://x.com/alice", "twitter");
assert(json.telegram === "https://t.me/orbitcat", "telegram");
assert(json.website === "https://orbit.cat", "website");
assert(json.description.includes("A cat on the curve."), "description keeps blurb");
assert(json.description.includes("OrbitX"), "description tags the pad");
assert(json.description.includes("@alice"), "description tags author");
assert(!("telegram" in buildPumpTokenMetadata({ name: "X", symbol: "X", description: "x" })), "omits empty socials");

const mint = "So11111111111111111111111111111111111111112";
const fallback = `https://www.orbitxtrade.world/api/token/${mint}/metadata`;
const coverAsUri = "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const pinned = "https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udw6t1l4lq6r5n3metadatajson";
assert(
  chooseMetadataUri({ fallbackUri: fallback, clientUri: coverAsUri }) === fallback,
  "cover image must not become the on-chain uri",
);
assert(
  chooseMetadataUri({ fallbackUri: fallback, pinnedGatewayUrl: pinned, clientUri: coverAsUri }) === pinned,
  "pinned json wins over a cover image",
);
assert(
  chooseMetadataUri({
    fallbackUri: fallback,
    clientUri: "https://www.orbitxtrade.world/api/token/So11111111111111111111111111111111111111112/metadata",
  }).endsWith("/metadata"),
  "explicit json uri is kept",
);

const serialized = JSON.stringify(json);
assert(serialized.includes('"showName":true'), "pump.fun showName");
assert(serialized.includes('"createdOn"'), "pump.fun createdOn");
assert(!looksLikeImageUri(chooseMetadataUri({ fallbackUri: fallback, clientUri: coverAsUri })), "fallback uri is json");

console.log(
  JSON.stringify({
    ok: true,
    keys: Object.keys(json),
    fallback,
    rejectedCover: coverAsUri,
  }),
);
