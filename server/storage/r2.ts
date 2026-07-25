import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 (plan §2.6) — VietSmart's heavy library files, zero egress.
// Verified via a real PUT/GET/DELETE round trip against the live bucket
// before any application code was written (see chat history).

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  throw new Error("R2 credentials are not set. Copy .env.example to .env.local and fill them in.");
}

const BUCKET = process.env.R2_BUCKET_NAME!;

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const PRESIGN_EXPIRY_SECONDS = 60 * 60; // 1 hour — generous for a single upload/download click

/** Presigned PUT URL: the client uploads directly to R2, bypassing our server for the file bytes. */
export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
}

/** Presigned GET URL — bucket is private (no r2.dev/custom domain set up), so downloads go through this. */
export async function getDownloadUrl(key: string, filename: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });
  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
