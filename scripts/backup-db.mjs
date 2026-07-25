// Logical (row-level JSON) backup of every table in the public schema,
// gzipped and uploaded to the same R2 bucket VietSmart already uses for
// library files, under a backups/ prefix. Belt-and-suspenders on top of
// Supabase's own retention — the free tier doesn't include automatic
// backups, so without this a project-level incident has no recovery path.
// Runs on a schedule via .github/workflows/keepalive-backup.yml.
import postgres from "postgres";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { gzipSync } from "node:zlib";
import { config } from "dotenv";

config({ path: ".env.local" });

const RETENTION_DAYS = 30;

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: "require",
  max: 1,
  connect_timeout: 20,
});

const tables = await sql`
  select tablename from pg_tables where schemaname = 'public' order by tablename
`;

const dump = {};
for (const { tablename } of tables) {
  dump[tablename] = await sql`select * from ${sql(tablename)}`;
}
await sql.end();

const gz = gzipSync(Buffer.from(JSON.stringify(dump)));

const bucket = process.env.R2_BUCKET_NAME;
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const key = `backups/${new Date().toISOString().slice(0, 10)}.json.gz`;
await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: gz, ContentType: "application/gzip" }));
console.log(`Backed up ${tables.length} tables (${gz.length} bytes) to ${key}.`);

const listed = await r2.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "backups/" }));
const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
for (const obj of listed.Contents ?? []) {
  const match = obj.Key.match(/^backups\/(\d{4}-\d{2}-\d{2})\.json\.gz$/);
  if (match && new Date(match[1]).getTime() < cutoff) {
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
    console.log(`Deleted backup past ${RETENTION_DAYS}-day retention: ${obj.Key}`);
  }
}
