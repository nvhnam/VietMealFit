// Applies pending migrations from server/db/migrations using drizzle-orm's own
// migrator, with the same postgres.js connection config the app uses everywhere
// else (prepare: false, ssl: require). The `drizzle-kit migrate` CLI hangs
// against this project's Supavisor pooler even though a plain postgres.js
// connection with the same DATABASE_URL succeeds reliably (see
// scripts/apply-migration-manual.mjs) — this script is the real fix: same
// working connection config, calling drizzle-orm's migrator directly instead
// of going through the CLI.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: "require",
  max: 1,
  connect_timeout: 20,
});
const db = drizzle(sql);

console.log("Applying pending migrations from server/db/migrations...");
await migrate(db, { migrationsFolder: "./server/db/migrations" });
console.log("Migrations up to date.");

await sql.end();
