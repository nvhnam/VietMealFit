// One-off workaround: drizzle-kit's own `migrate`/`push` commands hang against
// this project's Supavisor pooler (both session and transaction mode), even
// though a plain postgres.js connection with the same DATABASE_URL succeeds
// reliably. Applies the already-generated, hand-reviewed migration SQL
// directly instead. Not meant to replace drizzle-kit long-term — revisit once
// the underlying connectivity issue is understood (see chat for diagnosis).
import { readFileSync } from "node:fs";
import postgres from "postgres";
import "dotenv/config";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/apply-migration-manual.mjs <path-to-migration.sql>");
  process.exit(1);
}

const sqlText = readFileSync(path, "utf8");
// drizzle-kit-generated migrations use this marker to separate statements;
// hand-written SQL (e.g. policies.sql, with $$-quoted function bodies) has
// none, so it's run as a single multi-statement call instead (safe under
// postgres.js's simple-query protocol, which we use via prepare: false).
const statements = sqlText.includes("--> statement-breakpoint")
  ? sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
  : [sqlText];

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: "require",
  connect_timeout: 20,
});

console.log(`Applying ${statements.length} statements from ${path}...`);

async function runWithRetry(statement, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await sql.unsafe(statement);
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      const delayMs = 1000 * attempt;
      process.stdout.write(`(retry ${attempt}/${attempts} after ${err.code ?? err.message}) `);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

for (const [i, statement] of statements.entries()) {
  const label = statement.split("\n")[0].slice(0, 70);
  process.stdout.write(`[${i + 1}/${statements.length}] ${label}... `);
  await runWithRetry(statement);
  console.log("ok");
}

console.log("Done.");
await sql.end();
