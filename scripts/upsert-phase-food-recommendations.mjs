// Replaces the contents of phase_food_recommendations from
// data/seed/phase_food_recommendations.json. Safe to delete+reinsert (unlike
// recipes/exercises): nothing else in the schema references this table by FK.
// Run: node --env-file=.env.local scripts/upsert-phase-food-recommendations.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";
import "dotenv/config";

const rows = JSON.parse(readFileSync("data/seed/phase_food_recommendations.json", "utf8"));
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

// Not wrapped in sql.begin() — see scripts/upsert-recipes.mjs for why
// (held-open transactions have been unreliable against this project's
// Supabase pooler). Each statement retries independently instead.
await withRetry(() => sql`delete from phase_food_recommendations`);
await withRetry(
  () => sql`
    insert into phase_food_recommendations (phase, food_category, food_category_vi, recommendation, recommendation_vi)
    select * from jsonb_to_recordset(${sql.json(rows)}) as t(
      phase lean_phase, food_category text, food_category_vi text, recommendation text, recommendation_vi text
    )
  `,
);

console.log(`Replaced phase_food_recommendations with ${rows.length} rows.`);

const finalCount = await withRetry(() => sql`select count(*)::int as n from phase_food_recommendations`);
console.log("Final row count:", finalCount[0].n);

sql.end({ timeout: 1 });
process.exit(0);
