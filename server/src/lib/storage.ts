import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
