// Applies the same corrections as fix-food-names-vi.mjs (already run against
// data/seed/vietnam_food_composition_2007.csv) directly to the already-live
// nutrition_items table, matched by food_code. Needed because the CSV is
// only the original seed source — scripts/import-nutrition-items.mjs has no
// ON CONFLICT/upsert, so re-running the importer would create duplicate
// rows rather than fixing the existing ones.
//
// Idempotent: rows already showing the corrected name are skipped, not
// errored on. Any row whose current name_vi matches neither the expected
// pre-fix nor post-fix value aborts the whole run (no partial writes).
import postgres from "postgres";
import { config } from "dotenv";
import { CORRECTIONS } from "./fix-food-names-vi.mjs";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require", max: 1, connect_timeout: 20 });

// The Supavisor pooler drops idle-ish connections mid-script often enough
// (observed repeatedly during Phase 8) that a plain sequential loop of ~124
// awaited queries needs retry-with-reconnect, not just retry-with-backoff.
async function withRetry(fn, attempts = 6) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === attempts) throw err;
      console.log(`  (retry ${attempt}/${attempts} after ${err.code ?? err.message})`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const entries = Object.entries(CORRECTIONS);
const mismatches = [];
const toUpdate = [];
let alreadyFixed = 0;

for (const [foodCode, [oldValue, newValue]] of entries) {
  const [row] = await withRetry(() => sql`select id, name_vi from nutrition_items where food_code = ${foodCode}`);
  if (!row) {
    mismatches.push(`food_code ${foodCode}: no row found in nutrition_items`);
    continue;
  }
  if (row.name_vi === newValue) {
    alreadyFixed++;
    continue;
  }
  if (row.name_vi !== oldValue) {
    mismatches.push(
      `food_code ${foodCode}: expected ${JSON.stringify(oldValue)}, found ${JSON.stringify(row.name_vi)} — not touching`,
    );
    continue;
  }
  toUpdate.push({ id: row.id, foodCode, oldValue, newValue });
}

if (mismatches.length > 0) {
  console.error("Aborting — unexpected current state for some rows:");
  for (const m of mismatches) console.error(`  ${m}`);
  await sql.end();
  process.exit(1);
}

console.log(`${alreadyFixed} already correct, ${toUpdate.length} to update.`);

for (const { id, foodCode, oldValue, newValue } of toUpdate) {
  await withRetry(() => sql`update nutrition_items set name_vi = ${newValue} where id = ${id}`);
  console.log(`  ${foodCode}: ${JSON.stringify(oldValue)} -> ${JSON.stringify(newValue)}`);
}

console.log(`Done. Updated ${toUpdate.length} row(s).`);
await sql.end();
