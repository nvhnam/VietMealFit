// Polls the Supabase connection until it accepts a trivial query, or gives
// up after a timeout. One-off helper for waiting out the pooler flakiness
// documented in scripts/migrate.mjs / apply-migration-manual.mjs.
// Run: node --env-file=.env.local scripts/wait-for-db.mjs
import postgres from "postgres";
import "dotenv/config";

const MAX_WAIT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 10000;
const start = Date.now();

let attempt = 0;
while (Date.now() - start < MAX_WAIT_MS) {
  attempt++;
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require", max: 1, connect_timeout: 10 });
  try {
    // A plain query isn't enough to prove the pooler is healthy right now —
    // observed failure mode is: simple queries succeed, but any
    // sql.begin()-wrapped transaction (even trivial) fails immediately with
    // CONNECTION_CLOSED/ECONNRESET. The upsert scripts need transactions, so
    // check for the thing that actually matters.
    await sql.begin(async (tx) => {
      await tx`select 1`;
    });
    await sql.end();
    console.log(`DB reachable after ${attempt} attempt(s), ${Math.round((Date.now() - start) / 1000)}s.`);
    process.exit(0);
  } catch (err) {
    console.log(`Attempt ${attempt} failed (${err.code ?? err.message}), retrying in ${POLL_INTERVAL_MS / 1000}s...`);
    try {
      await sql.end({ timeout: 1 });
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

console.error(`DB still unreachable after ${MAX_WAIT_MS / 1000}s. Giving up.`);
process.exit(1);
