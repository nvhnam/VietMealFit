// Upserts data/seed/recipes.json into the live `recipes` table by name_vi,
// preserving row ids (meal_plan_items.recipe_id references recipes.id with
// onDelete: "restrict", so a blind truncate+reinsert would either fail or
// require deleting referencing rows — upserting in place avoids that
// entirely). Recipes no longer present in the JSON are deleted; if a delete
// is blocked by a live FK reference, it's skipped with a warning rather than
// forced.
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

await sql.begin(async (tx) => {
  for (const r of recipes) {
    const existing = await tx`select id from recipes where name_vi = ${r.name_vi} limit 1`;
    if (existing.length > 0) {
      await tx`
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
          allergen_tags = ${r.allergen_tags},
          source = ${r.source}
        where id = ${existing[0].id}
      `;
      updated++;
    } else {
      await tx`
        insert into recipes
          (name_vi, name_en, meal_type, diet_tags, calories, protein_g, carb_g, fat_g, ingredients, instructions, allergen_tags, source)
        values (
          ${r.name_vi}, ${r.name_en}, ${r.meal_type}, ${r.diet_tags}, ${r.calories},
          ${r.protein_g}, ${r.carb_g}, ${r.fat_g}, ${sql.json(r.ingredients)}, ${r.instructions}, ${r.allergen_tags}, ${r.source}
        )
      `;
      inserted++;
    }
  }

  // Remove rows from the old catalog that are no longer in the new set.
  // Each delete runs in its own savepoint so a single FK-restrict failure
  // (a live meal plan still referencing that recipe) doesn't abort the
  // whole transaction — it's just rolled back to before that one delete.
  const stale = await tx`select id, name_vi from recipes where name_vi != ALL(${sql.array([...names])})`;
  for (const row of stale) {
    try {
      await tx.savepoint(async (sp) => {
        await sp`delete from recipes where id = ${row.id}`;
      });
      deleted++;
    } catch (err) {
      console.log(`  Skipped deleting "${row.name_vi}" (${row.id}): ${err.message} — likely still referenced by a user's meal plan.`);
      deleteSkipped++;
    }
  }
});

console.log(`Updated: ${updated}, Inserted: ${inserted}, Deleted: ${deleted}, Delete-skipped (FK-referenced): ${deleteSkipped}`);

const finalCount = await withRetry(() => sql`select count(*)::int as n from recipes`);
console.log("Final recipes row count:", finalCount[0].n);

await sql.end();
