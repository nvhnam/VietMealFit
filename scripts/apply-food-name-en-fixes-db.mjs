// Applies the same corrections as fix-food-names-en.mjs (already run against
// data/seed/vietnam_food_composition_2007.csv) directly to the already-live
// nutrition_items table, matched by food_code. Needed for the same reason as
// apply-food-name-fixes-db.mjs: scripts/import-nutrition-items.mjs has no
// ON CONFLICT/upsert, so re-running the importer would duplicate rows rather
// than fix the existing ones.
//
// An empty newValue in CORRECTIONS means "the source has no English name for
// this food", which is stored as NULL — matching what the importer would write
// for the now-empty CSV field.
//
// Idempotent: rows already showing the corrected value are skipped, not
// errored on. Any row whose current name_en matches neither the expected
// pre-fix nor post-fix value aborts the whole run (no partial writes).
import postgres from "postgres";
import { config } from "dotenv";
import { CORRECTIONS } from "./fix-food-names-en.mjs";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require", max: 1, connect_timeout: 20 });

// Same retry-with-reconnect as apply-food-name-fixes-db.mjs — the Supavisor
// pooler drops idle-ish connections mid-script often enough to matter.
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

const toStored = (value) => (value === "" ? null : value);

const mismatches = [];
const toUpdate = [];
let alreadyFixed = 0;

for (const [foodCode, [oldValue, newValue]] of Object.entries(CORRECTIONS)) {
  const [row] = await withRetry(() => sql`select id, name_en from nutrition_items where food_code = ${foodCode}`);
  if (!row) {
    mismatches.push(`food_code ${foodCode}: no row found in nutrition_items`);
    continue;
  }
  if (row.name_en === toStored(newValue)) {
    alreadyFixed++;
    continue;
  }
  if (row.name_en !== oldValue) {
    mismatches.push(
      `food_code ${foodCode}: expected ${JSON.stringify(oldValue)}, found ${JSON.stringify(row.name_en)} — not touching`,
    );
    continue;
  }
  toUpdate.push({ id: row.id, foodCode, oldValue, newValue: toStored(newValue) });
}

if (mismatches.length > 0) {
  console.error("Aborting — unexpected current state for some rows:");
  for (const m of mismatches) console.error(`  ${m}`);
  await sql.end();
  process.exit(1);
}

console.log(`${alreadyFixed} already correct, ${toUpdate.length} to update.`);
for (const u of toUpdate) {
  await withRetry(() => sql`update nutrition_items set name_en = ${u.newValue} where id = ${u.id}`);
  console.log(`  ${u.foodCode}: ${JSON.stringify(u.oldValue)} -> ${JSON.stringify(u.newValue)}`);
}

console.log(`Done. ${toUpdate.length} row(s) updated.`);
await sql.end();
