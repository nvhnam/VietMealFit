// One-time seed: data/seed/vietnam_food_composition_2007.csv -> nutrition_items.
// Run: node --env-file=.env.local scripts/import-nutrition-items.mjs
//
// Category labels below were NOT copied from the official table's printed
// group headings (I couldn't verify those with confidence) — they were
// derived empirically by inspecting which Food_Code range each label's
// sample items actually fall in (see chat history for the food names
// sampled per group). Food_Code encodes the group as floor(code / 1000),
// confirmed against all 526 rows (per-group counts sum exactly to 526).
// Worth a human sanity check against the source document if precise
// official group titles matter later.
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import postgres from "postgres";
import "dotenv/config";

const CSV_PATH = "data/seed/vietnam_food_composition_2007.csv";

const CATEGORY_BY_GROUP = {
  1: "Cereals and products",
  2: "Roots and tubers",
  3: "Protein/fat-rich nuts, seeds, and legumes",
  4: "Vegetables",
  5: "Fruits",
  6: "Fats and oils",
  7: "Meat and products",
  8: "Fish and aquatic products",
  9: "Eggs and products",
  10: "Milk and dairy products",
  11: "Canned and preserved foods",
  12: "Cakes, biscuits, and confectionery",
  13: "Spices and condiments",
  14: "Beverages",
};

// First-class columns per plan §4.1 — everything else goes into extended_nutrients.
const FIRST_CLASS = new Set([
  "STT",
  "Food_Code",
  "Food_Name_Vietnamese",
  "Food_Name_English",
  "Energy_kcal",
  "Protein_g",
  "Fat_g",
  "Carbohydrate_g",
  "Fiber_g",
]);

function toNumericOrNull(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null; // pass raw numeric string through, avoid float round-trip
}

function categoryForFoodCode(foodCode) {
  const group = Math.floor(Number(foodCode) / 1000);
  return CATEGORY_BY_GROUP[group] ?? null;
}

const csvText = readFileSync(CSV_PATH, "utf8");
const records = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  trim: true,
});

console.log(`Parsed ${records.length} rows from ${CSV_PATH}`);
if (records.length !== 526) {
  console.warn(`WARNING: expected 526 rows, got ${records.length} — investigate before proceeding.`);
}

const rows = records.map((r) => {
  const extended = {};
  for (const [key, value] of Object.entries(r)) {
    if (FIRST_CLASS.has(key)) continue;
    extended[key] = value?.trim() ? value.trim() : null;
  }

  return {
    food_code: r.Food_Code.trim(),
    name_vi: r.Food_Name_Vietnamese.trim(),
    name_en: r.Food_Name_English?.trim() || null,
    category: categoryForFoodCode(r.Food_Code),
    energy_kcal: toNumericOrNull(r.Energy_kcal),
    protein_g: toNumericOrNull(r.Protein_g),
    fat_g: toNumericOrNull(r.Fat_g),
    carbohydrate_g: toNumericOrNull(r.Carbohydrate_g),
    fiber_g: toNumericOrNull(r.Fiber_g),
    extended_nutrients: extended,
  };
});

// Sanity checks before touching the DB.
const uniqueCodes = new Set(rows.map((r) => r.food_code));
if (uniqueCodes.size !== rows.length) {
  console.error(`FAILED: duplicate food_code values found (${rows.length - uniqueCodes.size} dupes) — aborting.`);
  process.exit(1);
}
const missingCategory = rows.filter((r) => r.category === null);
if (missingCategory.length > 0) {
  console.warn(`WARNING: ${missingCategory.length} rows have no category mapping:`, missingCategory.map((r) => r.food_code));
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require", connect_timeout: 20 });

async function insertBatchWithRetry(batch, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await sql`
        insert into nutrition_items
          (food_code, name_vi, name_en, category, energy_kcal, protein_g, fat_g, carbohydrate_g, fiber_g, extended_nutrients)
        select * from jsonb_to_recordset(${sql.json(batch)}) as t(
          food_code text, name_vi text, name_en text, category text,
          energy_kcal numeric, protein_g numeric, fat_g numeric, carbohydrate_g numeric, fiber_g numeric,
          extended_nutrients jsonb
        )
      `;
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      console.log(`  (retry ${attempt}/${attempts} after ${err.code ?? err.message})`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const BATCH_SIZE = 50;
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  await insertBatchWithRetry(batch);
  inserted += batch.length;
  console.log(`Inserted ${inserted}/${rows.length}`);
}

console.log("Done.");
await sql.end();
