// Upserts data/seed/exercises.json into the live `exercises` table by name,
// mirroring scripts/upsert-recipes.mjs (exercise_plan_items.exercise_id
// references exercises.id with onDelete: "restrict", so upserting in place
// avoids the FK issues a truncate+reinsert would risk).
//
// Deliberately NOT wrapped in a single sql.begin() transaction — see the
// comment in scripts/upsert-recipes.mjs for why (a held-open transaction
// across ~25 round trips reliably died mid-way against this project's
// Supabase pooler; short independent retried statements succeed).
// Run: node --env-file=.env.local scripts/upsert-exercises.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";
import "dotenv/config";

const exercisesData = JSON.parse(readFileSync("data/seed/exercises.json", "utf8"));
const names = new Set(exercisesData.map((e) => e.name));

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

const existingRows = await withRetry(() => sql`select id, name from exercises`);
const byName = new Map(existingRows.map((r) => [r.name, r.id]));

for (const e of exercisesData) {
  const existingId = byName.get(e.name);
  if (existingId) {
    await withRetry(
      () => sql`
        update exercises set
          name_vi = ${e.name_vi ?? null},
          name_en = ${e.name_en ?? null},
          muscle_groups = ${e.muscle_groups},
          equipment = ${e.equipment},
          difficulty = ${e.difficulty},
          default_sets = ${e.default_sets},
          rep_scheme = ${e.rep_scheme},
          rep_scheme_vi = ${e.rep_scheme_vi ?? null},
          instructions = ${e.instructions},
          instructions_vi = ${e.instructions_vi ?? null},
          video_url = ${e.video_url ?? null},
          video_url_vi = ${e.video_url_vi ?? null},
          limitation_tags = ${e.limitation_tags}
        where id = ${existingId}
      `,
    );
    updated++;
  } else {
    await withRetry(
      () => sql`
        insert into exercises
          (name, name_vi, name_en, muscle_groups, equipment, difficulty, default_sets, rep_scheme, rep_scheme_vi, instructions, instructions_vi, video_url, video_url_vi, limitation_tags)
        values (
          ${e.name}, ${e.name_vi ?? null}, ${e.name_en ?? null}, ${e.muscle_groups}, ${e.equipment},
          ${e.difficulty}, ${e.default_sets}, ${e.rep_scheme}, ${e.rep_scheme_vi ?? null},
          ${e.instructions}, ${e.instructions_vi ?? null}, ${e.video_url ?? null}, ${e.video_url_vi ?? null}, ${e.limitation_tags}
        )
      `,
    );
    inserted++;
  }
}

const stale = existingRows.filter((row) => !names.has(row.name));
for (const row of stale) {
  try {
    await withRetry(() => sql`delete from exercises where id = ${row.id}`, 2);
    deleted++;
  } catch (err) {
    console.log(`  Skipped deleting "${row.name}" (${row.id}): ${err.message} — likely still referenced by a user's exercise plan.`);
    deleteSkipped++;
  }
}

console.log(`Updated: ${updated}, Inserted: ${inserted}, Deleted: ${deleted}, Delete-skipped (FK-referenced): ${deleteSkipped}`);

const finalCount = await withRetry(() => sql`select count(*)::int as n from exercises`);
console.log("Final exercises row count:", finalCount[0].n);

sql.end({ timeout: 1 });
process.exit(0);
