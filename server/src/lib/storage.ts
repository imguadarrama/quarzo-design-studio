import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export interface UploadImageInput {
  buffer: Buffer;
  contentType: string;
  prefix: string;
}

export interface UploadImageResult {
  url: string;
  key: string;
}

export async function uploadImage({
  buffer,
  contentType,
  prefix,
}: UploadImageInput): Promise<UploadImageResult> {
  const key = env.R2_KEY_PREFIX
    ? `${env.R2_KEY_PREFIX}/${prefix}/${randomUUID()}.jpg`
    : `${prefix}/${randomUUID()}.jpg`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { url: `${env.R2_PUBLIC_BASE_URL}/${key}`, key };
}

// Returns the R2 key for a URL we own, or null for anything outside our
// public base (legacy picsum.photos seed URLs, future custom-domain
// migrations, hand-pasted external URLs). Filtering at the boundary keeps
// the delete batch from sending bogus keys to R2.
export function extractKeyFromUrl(url: string): string | null {
  const prefix = `${env.R2_PUBLIC_BASE_URL}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.length > 0 ? key : null;
}

export interface DeleteImageKeysResult {
  failed: string[];
}

// Best-effort batch delete. R2 supports up to 1000 keys per call and treats
// missing keys as success (idempotent), so retries and double-deletes are
// safe. The caller is expected to have already deleted the corresponding
// DB rows; if R2 rejects some keys we log and return them as orphans for
// a future janitor sweep — we never throw.
export async function deleteImageKeys(
  keys: string[],
): Promise<DeleteImageKeysResult> {
  if (keys.length === 0) return { failed: [] };
  try {
    const response = await s3.send(
      new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    const failed = (response.Errors ?? [])
      .map((e) => e.Key)
      .filter((k): k is string => typeof k === "string");
    return { failed };
  } catch (err) {
    console.warn("[r2] DeleteObjects failed", { keys, err });
    return { failed: keys };
  }
}
