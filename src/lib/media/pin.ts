import "server-only";

import { IPFS_GATEWAY } from "@/lib/media/ipfs";

export type PinResult = {
  cid: string;
  uri: string;
  gatewayUrl: string;
};

function wrap(cid: string): PinResult {
  return { cid, uri: `ipfs://${cid}`, gatewayUrl: `${IPFS_GATEWAY}/${cid}` };
}

/** Pin raw bytes to IPFS via Pinata or NFT.Storage. Returns null when no pin token is set or the pin fails. */
export async function pinBytes(
  bytes: Buffer | Uint8Array,
  filename: string,
  contentType: string,
): Promise<PinResult | null> {
  const payload = Buffer.from(bytes);
  const pinata = process.env.PINATA_JWT?.trim();
  if (pinata) {
    try {
      const body = new FormData();
      body.append("file", new Blob([payload], { type: contentType }), filename);
      body.append("pinataMetadata", JSON.stringify({ name: filename }));
      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${pinata}` },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { IpfsHash?: string };
      if (json.IpfsHash) return wrap(json.IpfsHash);
    } catch {
      return null;
    }
  }

  const nftStorage = process.env.NFT_STORAGE_TOKEN?.trim();
  if (nftStorage) {
    try {
      const res = await fetch("https://api.nft.storage/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${nftStorage}`,
          "Content-Type": contentType,
        },
        body: payload,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { value?: { cid?: string }; ok?: boolean };
      const cid = json.value?.cid;
      if (cid) return wrap(cid);
    } catch {
      return null;
    }
  }

  return null;
}

export async function pinJson(value: unknown, filename = "metadata.json"): Promise<PinResult | null> {
  return pinBytes(Buffer.from(JSON.stringify(value)), filename, "application/json");
}
