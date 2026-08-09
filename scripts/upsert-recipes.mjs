// Upserts data/seed/recipes.json into the live `recipes` table by name_vi,
// preserving row ids (meal_plan_items.recipe_id references recipes.id with
// onDelete: "restrict", so a blind truncate+reinsert would either fail or
// require deleting referencing rows — upserting in place avoids that
// entirely). Recipes no longer present in the JSON are deleted; if a delete
// is blocked by a live FK reference, it's skipped with a warning rather than
// forced.
//
// Deliberately NOT wrapped in a single sql.begin() transaction: against this
// project's Supabase pooler, a transaction held open across ~70 sequential
// round trips reliably dies mid-way with CONNECTION_CLOSED/ECONNRESET, while
// short independent statements succeed. Each row's update/insert is already
// atomic on its own, so per-statement retry (same pattern as
// scripts/apply-migration-manual.mjs) trades whole-batch atomicity for
// actually being able to complete — the right trade here since the batch
// transaction was failing 100% of the time, not intermittently.
// Run: node --env-file=.env.local scripts/upsert-recipes.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";
import "dotenv/config";

const recipes = JSON.parse(readFileSync("data/seed/recipes.json", "utf8"));
const names = new Set(recipes.map((r) => r.name_vi));

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require", connect_timeout: 20 });

async function withRetry(fn, attempts = 5) {
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

let updated = 0;
let inserted = 0;
let deleted = 0;
let deleteSkipped = 0;

const existingRows = await withRetry(() => sql`select id, name_vi from recipes`);
const byName = new Map(existingRows.map((r) => [r.name_vi, r.id]));

for (const r of recipes) {
  const existingId = byName.get(r.name_vi);
  if (existingId) {
    await withRetry(
      () => sql`
        update recipes set
          name_en = ${r.name_en},
          meal_type = ${r.meal_type},
          diet_tags = ${r.diet_tags},
          calories = ${r.calories},
          protein_g = ${r.protein_g},
          carb_g = ${r.carb_g},
          fat_g = ${r.fat_g},
          ingredients = ${sql.json(r.ingredients)},
          instructions = ${r.instructions},
          instructions_vi = ${r.instructions_vi ?? null},
          allergen_tags = ${r.allergen_tags},
          source = ${r.source}
        where id = ${existingId}
      `,
    );
    updated++;
  } else {
    await withRetry(
      () => sql`
        insert into recipes
          (name_vi, name_en, meal_type, diet_tags, calories, protein_g, carb_g, fat_g, ingredients, instructions, instructions_vi, allergen_tags, source)
        values (
          ${r.name_vi}, ${r.name_en}, ${r.meal_type}, ${r.diet_tags}, ${r.calories},
          ${r.protein_g}, ${r.carb_g}, ${r.fat_g}, ${sql.json(r.ingredients)}, ${r.instructions}, ${r.instructions_vi ?? null}, ${r.allergen_tags}, ${r.source}
        )
      `,
    );
    inserted++;
  }
}

const stale = existingRows.filter((row) => !names.has(row.name_vi));
for (const row of stale) {
  try {
    await withRetry(() => sql`delete from recipes where id = ${row.id}`, 2);
    deleted++;
  } catch (err) {
    console.log(`  Skipped deleting "${row.name_vi}" (${row.id}): ${err.message} — likely still referenced by a user's meal plan.`);
    deleteSkipped++;
  }
}

console.log(`Updated: ${updated}, Inserted: ${inserted}, Deleted: ${deleted}, Delete-skipped (FK-referenced): ${deleteSkipped}`);

const finalCount = await withRetry(() => sql`select count(*)::int as n from recipes`);
console.log("Final recipes row count:", finalCount[0].n);

// Not awaited: sql.end()'s graceful-close handshake has been hanging under
// the same pooler flakiness this script otherwise retries around, blocking
// process exit indefinitely even after all work above completed successfully.
// A one-off script exiting immediately after logging its result is fine.
sql.end({ timeout: 1 });
process.exit(0);
