// One-time seed: data/seed/recipes.json + exercises.json -> recipes / exercises.
// Run: node --env-file=.env.local scripts/seed-catalogs.mjs
//
// Hand-curated starter content (see plan §8: catalog thinness is a real risk,
// not filled with throwaway placeholders — but these are still first-pass
// estimates, not lab-measured or professionally reviewed). video_url is left
// NULL for every exercise: fabricating YouTube links/IDs would risk pointing
// at broken or unrelated content, so real instructional videos need to be
// sourced and added by a human later.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import "dotenv/config";

const recipes = JSON.parse(readFileSync("data/seed/recipes.json", "utf8"));
const exercises = JSON.parse(readFileSync("data/seed/exercises.json", "utf8"));

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

console.log(`Seeding ${recipes.length} recipes...`);
await withRetry(() => sql`
  insert into recipes
    (name_vi, name_en, meal_type, diet_tags, calories, protein_g, carb_g, fat_g, ingredients, instructions, allergen_tags, source)
  select * from jsonb_to_recordset(${sql.json(recipes)}) as t(
    name_vi text, name_en text, meal_type meal_type, diet_tags text[], calories int,
    protein_g numeric, carb_g numeric, fat_g numeric, ingredients jsonb, instructions text,
    allergen_tags text[], source text
  )
`);
console.log("Recipes done.");

console.log(`Seeding ${exercises.length} exercises...`);
await withRetry(() => sql`
  insert into exercises
    (name, muscle_groups, equipment, difficulty, default_sets, rep_scheme, instructions, limitation_tags)
  select * from jsonb_to_recordset(${sql.json(exercises)}) as t(
    name text, muscle_groups text[], equipment text, difficulty difficulty,
    default_sets smallint, rep_scheme text, instructions text, limitation_tags text[]
  )
`);
console.log("Exercises done.");

await sql.end();
