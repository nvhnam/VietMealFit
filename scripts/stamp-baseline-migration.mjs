// One-off: server/db/migrations/0000_wet_spyke.sql is a baseline generated from
// the schema that was already applied to the live DB via `drizzle-kit push`
// across Phases 0-7 (this project had no migrations/ folder until Phase 8).
// Running it for real would try to CREATE TABLE on objects that already exist.
// Instead, seed drizzle's own migrations-journal table with its hash/timestamp
// so `drizzle-orm`'s migrator (see scripts/migrate.mjs) treats it as already
// applied and only runs migrations generated after this point.
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";
import { config } from "dotenv";

// dotenv/config defaults to loading `.env`, which this project doesn't have —
// DATABASE_URL lives in `.env.local` (Next.js convention), same as drizzle.config.ts.
config({ path: ".env.local" });

const [migration] = readMigrationFiles({ migrationsFolder: "./server/db/migrations" });
if (!migration) {
  console.error("No migration files found under server/db/migrations.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: "require",
  max: 1,
  connect_timeout: 20,
});

async function withRetry(fn, attempts = 6) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === attempts) throw err;
      const delayMs = 1000 * attempt;
      console.log(`(retry ${attempt}/${attempts} after ${err.code ?? err.message}, waiting ${delayMs}ms)`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

await withRetry(() => sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
await withRetry(
  () => sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `
);

const [existing] = await withRetry(
  () => sql`select id from drizzle.__drizzle_migrations where hash = ${migration.hash}`
);
if (existing) {
  console.log("Baseline migration already stamped as applied. Nothing to do.");
} else {
  await withRetry(
    () => sql`
      insert into drizzle.__drizzle_migrations ("hash", "created_at")
      values (${migration.hash}, ${migration.folderMillis})
    `
  );
  console.log(`Stamped baseline migration (hash ${migration.hash.slice(0, 12)}...) as already applied.`);
}

await sql.end();
