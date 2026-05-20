import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 configuration - uses S3-compatible API
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "radio-music";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!; // e.g., https://pub-xxx.r2.dev or custom domain

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await r2Client.send(command);

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
    size: file.length,
  };
}

export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

export function generateTrackKey(artistSlug: string, filename: string): string {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
  return `music/${artistSlug}/${sanitized}`;
}

export function generateCoverKey(type: "artist" | "album" | "playlist", id: number, ext: string): string {
  return `covers/${type}/${id}.${ext}`;
}

export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}
