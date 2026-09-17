import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { parseIpfsInput } from "@/lib/media/ipfs";
import { pinBytes } from "@/lib/media/pin";

const MAX_BYTES = 4_500_000;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type CoverResult = {
  url: string;
  imageUri: string;
  cid: string | null;
  storage: "ipfs" | "supabase";
};

function extFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export async function storeCover(userId: string, file: File): Promise<CoverResult> {
  if (!ALLOWED.has(file.type)) throw new Error("Use a PNG, JPEG, WebP, or GIF.");
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error("Image must be under 4.5 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${userId}/${crypto.randomUUID()}.${extFor(file.type)}`;
  const service = createServiceClient();
  const { error } = await service.storage.from("covers").upload(filename, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = service.storage.from("covers").getPublicUrl(filename);
  const pinned = await pinBytes(bytes, filename.split("/").pop() ?? "cover.png", file.type);
  if (pinned) {
    return {
      url: pinned.gatewayUrl,
      imageUri: pinned.uri,
      cid: pinned.cid,
      storage: "ipfs",
    };
  }
  return {
    url: data.publicUrl,
    imageUri: data.publicUrl,
    cid: null,
    storage: "supabase",
  };
}

export function coverFromPaste(raw: string): CoverResult | null {
  const ipfs = parseIpfsInput(raw);
  if (ipfs) {
    return { url: ipfs.gatewayUrl, imageUri: ipfs.uri, cid: ipfs.cid, storage: "ipfs" };
  }
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    return { url: url.toString(), imageUri: url.toString(), cid: null, storage: "supabase" };
  } catch {
    return null;
  }
}
