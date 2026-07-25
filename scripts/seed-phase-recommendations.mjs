// One-time seed: data/seed/phase_food_recommendations.json -> phase_food_recommendations.
// Run: node --env-file=.env.local scripts/seed-phase-recommendations.mjs
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

console.log(`Seeding ${rows.length} phase_food_recommendations...`);
await withRetry(() => sql`
  insert into phase_food_recommendations (phase, food_category, recommendation)
  select * from jsonb_to_recordset(${sql.json(rows)}) as t(
    phase lean_phase, food_category text, recommendation text
  )
`);
console.log("Done.");

await sql.end();
