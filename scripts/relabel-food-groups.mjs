// Relabels nutrition_items.category with the food-group names printed in the
// 2007 composition table (data/seed/food_groups_2007.json, English wording)
// instead of the labels import-nutrition-items.mjs originally made up. VietSearch
// no longer reads this column to filter or label groups — it derives the group
// from food_code — so this only brings the stored data in line with the book.
//
// A row is updated only while it still carries the old label for its group; any
// other value aborts the run before anything is written. The old labels are
// listed below, so the change is reversible without a backup file.
//
// Usage (from the repo root):
//   node scripts/relabel-food-groups.mjs --check
//   node scripts/relabel-food-groups.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const CHECK_ONLY = process.argv.includes("--check");

// What import-nutrition-items.mjs wrote before the labels followed the book.
const OLD_LABELS = {
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
const { groups } = JSON.parse(readFileSync("data/seed/food_groups_2007.json", "utf8"));
const NEW_LABELS = Object.fromEntries(groups.map((g) => [g.group, g.en]));

const groupOf = (foodCode) => Math.floor(Number(foodCode) / 1000);

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require", max: 1, connect_timeout: 20 });

const rows = await sql`select food_code, category from nutrition_items`;
const problems = [];
const pendingByGroup = new Map();
let alreadyCorrect = 0;
for (const row of rows) {
  const group = groupOf(row.food_code);
  if (!NEW_LABELS[group]) {
    problems.push(`food_code ${row.food_code}: no food group ${group}`);
  } else if (row.category === NEW_LABELS[group]) {
    alreadyCorrect++;
  } else if (row.category !== OLD_LABELS[group]) {
    problems.push(`food_code ${row.food_code}: expected ${JSON.stringify(OLD_LABELS[group])}, found ${JSON.stringify(row.category)}`);
  } else {
    pendingByGroup.set(group, (pendingByGroup.get(group) ?? 0) + 1);
  }
}

if (problems.length > 0) {
  console.error("Aborting — no changes written. Unexpected current values:");
  for (const p of problems) console.error(`  ${p}`);
  await sql.end();
  process.exit(1);
}

const pending = [...pendingByGroup.values()].reduce((a, b) => a + b, 0);
console.log(`${rows.length} rows: ${pending} ${CHECK_ONLY ? "would be relabelled" : "to relabel"}, ${alreadyCorrect} already correct.`);
for (const [group, count] of pendingByGroup) {
  console.log(`  ${group}: ${JSON.stringify(OLD_LABELS[group])} -> ${JSON.stringify(NEW_LABELS[group])} (${count})`);
}
if (CHECK_ONLY || pending === 0) {
  await sql.end();
  process.exit(0);
}

const records = [...pendingByGroup.keys()].map((group) => ({
  grp: group,
  old_label: OLD_LABELS[group],
  new_label: NEW_LABELS[group],
}));
await sql.begin(async (tx) => {
  const result = await tx`
    update nutrition_items as n
    set category = t.new_label
    from jsonb_to_recordset(${tx.json(records)}) as t(grp int, old_label text, new_label text)
    where n.food_code::int / 1000 = t.grp and n.category = t.old_label`;
  if (result.count !== pending) {
    throw new Error(`Updated ${result.count} row(s), expected ${pending} — transaction rolled back.`);
  }
});

const after = await sql`select food_code, category from nutrition_items`;
await sql.end();
const wrong = after.filter((row) => row.category !== NEW_LABELS[groupOf(row.food_code)]);
if (wrong.length > 0) {
  console.error(`Post-check failed for ${wrong.length} row(s):`, wrong.slice(0, 10));
  process.exit(1);
}
console.log(`Done. All ${after.length} rows carry the book's group name.`);
