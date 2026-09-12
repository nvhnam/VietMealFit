// Fixes the discrepancies found when data/seed/vietnam_food_composition_2007.csv
// was verified cell by cell against its source, data/VTN_FCT_2007.pdf
// (Bảng thành phần thực phẩm Việt Nam, NXB Y học 2007), in September 2026.
// Every correction and the PDF page it was read from is recorded in
// data/seed/vietnam_food_composition_2007_pdf_corrections.json:
//
// - Total_PUFA_g (228 rows): the PDF carries a hidden duplicate text layer that
//   prints "0 200" under the visible "0.200", and the original digitization kept
//   only the integer part ("0", "2", "21"). Duck meat (7028) prints its value one
//   line below the label and had been digitized as "3" instead of "2.815".
// - Cholesterol_mg (5044): the value cell is blank; its source code "1" had been
//   digitized as the value.
// - Food_Name_Vietnamese (16 rows): misspellings that fix-food-names-vi.mjs
//   missed, plus two of its entries that contradicted the book (2002 is printed
//   "Củ cái", winged yam; 13010 is printed "Magi").
// - Food_Name_Vietnamese (10 rows, name_normalizations): Vietnamese orthography where
//   the book's typography is inconsistent — e.g. "Đậu Hà lan" -> "Đậu Hà Lan",
//   "(cồn 10.2 g)" -> "(cồn 10,2 g)". These intentionally differ from the printed text.
//
// Both targets are idempotent: a cell already at its corrected value is skipped,
// and a cell at neither the expected old value nor the new one aborts the run
// before anything is written. The database update is a single transaction.
//
// Usage (from the repo root):
//   node scripts/fix-fct-pdf-discrepancies.mjs --csv --check
//   node scripts/fix-fct-pdf-discrepancies.mjs --csv
//   node scripts/fix-fct-pdf-discrepancies.mjs --db --check
//   node scripts/fix-fct-pdf-discrepancies.mjs --db --backup=<rows-before.json>
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { config } from "dotenv";
import { readField, quoteField } from "./fix-food-names-vi.mjs";

const CSV_PATH = "data/seed/vietnam_food_composition_2007.csv";
const CORRECTIONS_PATH = "data/seed/vietnam_food_composition_2007_pdf_corrections.json";
const CHECK_ONLY = process.argv.includes("--check");
const DO_CSV = process.argv.includes("--csv");
const DO_DB = process.argv.includes("--db");
const BACKUP_PATH = process.argv.find((a) => a.startsWith("--backup="))?.slice("--backup=".length);

if (DO_CSV === DO_DB) {
  console.error("Pass exactly one of --csv or --db.");
  process.exit(1);
}

// Each entry: { code, column, old, new, pdf_page | reason }. column is the CSV header name;
// "" is a blank CSV cell, stored as null in the database. name_normalizations are the
// deliberate departures from the book's typography (capitalisation, decimal comma, spacing).
const { names, values, name_normalizations = [] } = JSON.parse(readFileSync(CORRECTIONS_PATH, "utf8"));
const corrections = [...names, ...values, ...name_normalizations];

const EXTENDED_COLUMNS = new Set(["Total_PUFA_g", "Cholesterol_mg"]);
for (const c of corrections) {
  if (c.column !== "Food_Name_Vietnamese" && !EXTENDED_COLUMNS.has(c.column)) {
    throw new Error(`Unsupported column ${c.column} (food_code ${c.code}).`);
  }
}

function splitFields(line) {
  const fields = [];
  let i = 0;
  for (;;) {
    const field = readField(line, i);
    fields.push(field);
    if (line[field.end] !== ",") return fields;
    i = field.end + 1;
  }
}

function abort(problems) {
  console.error("Aborting — no changes written. Unexpected current values:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

if (DO_CSV) {
  const raw = readFileSync(CSV_PATH, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n"; // the seed file is CRLF; write back what was read
  const lines = raw.split(eol);
  if (lines.some((line) => line.includes("\r"))) throw new Error(`${CSV_PATH} mixes line endings — aborting.`);
  const header = splitFields(lines[0].replace(/^﻿/, "")).map((f) => f.value);
  const columnIndex = new Map(header.map((name, idx) => [name, idx]));
  const rowIndex = new Map();
  lines.forEach((line, idx) => {
    if (idx > 0 && line.length > 0) rowIndex.set(splitFields(line)[1].value, idx);
  });

  const problems = [];
  let changed = 0;
  let alreadyFixed = 0;
  for (const c of corrections) {
    const col = columnIndex.get(c.column);
    const idx = rowIndex.get(c.code);
    if (col === undefined || idx === undefined) {
      problems.push(`food_code ${c.code} / ${c.column}: row or column not found`);
      continue;
    }
    const field = splitFields(lines[idx])[col]; // re-split: an earlier splice may have moved offsets
    if (field.value === c.new) {
      alreadyFixed++;
      continue;
    }
    if (field.value !== c.old) {
      problems.push(`food_code ${c.code} / ${c.column}: expected ${JSON.stringify(c.old)}, found ${JSON.stringify(field.value)}`);
      continue;
    }
    lines[idx] = lines[idx].slice(0, field.start) + quoteField(c.new) + lines[idx].slice(field.end);
    changed++;
  }
  if (problems.length > 0) abort(problems);

  console.log(`CSV: ${changed} cell(s) ${CHECK_ONLY ? "would change" : "changed"}, ${alreadyFixed} already correct (${corrections.length} total).`);
  if (!CHECK_ONLY && changed > 0) {
    writeFileSync(CSV_PATH, lines.join(eol));
    console.log(`Wrote ${CSV_PATH}.`);
  }
}

if (DO_DB) {
  config({ path: ".env.local" });
  if (!CHECK_ONLY && !BACKUP_PATH) {
    console.error("Pass --backup=<file.json> when applying to the database.");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require", max: 1, connect_timeout: 20 });

  // Same retry-with-reconnect as apply-food-name-fixes-db.mjs, for the read queries only;
  // the transaction is never retried, so a failure there leaves the table untouched.
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

  const currentValue = (row, column) =>
    (column === "Food_Name_Vietnamese" ? row.name_vi : row.extended_nutrients?.[column]) ?? "";

  const codes = [...new Set(corrections.map((c) => c.code))];
  const selectRows = () =>
    withRetry(() => sql`select id, food_code, name_vi, extended_nutrients from nutrition_items where food_code in ${sql(codes)}`);
  const before = new Map((await selectRows()).map((r) => [r.food_code, r]));

  const problems = [];
  const pendingByColumn = new Map();
  let pendingCount = 0;
  let alreadyFixed = 0;
  for (const c of corrections) {
    const row = before.get(c.code);
    if (!row) {
      problems.push(`food_code ${c.code}: no row in nutrition_items`);
      continue;
    }
    const value = currentValue(row, c.column);
    if (value === c.new) {
      alreadyFixed++;
      continue;
    }
    if (value !== c.old) {
      problems.push(`food_code ${c.code} / ${c.column}: expected ${JSON.stringify(c.old)}, found ${JSON.stringify(value)}`);
      continue;
    }
    const batch = pendingByColumn.get(c.column) ?? [];
    if (batch.some((p) => p.code === c.code)) throw new Error(`Duplicate correction for ${c.code} / ${c.column}.`);
    batch.push(c);
    pendingByColumn.set(c.column, batch);
    pendingCount++;
  }
  if (problems.length > 0) {
    await sql.end();
    abort(problems);
  }

  console.log(`DB: ${pendingCount} cell(s) ${CHECK_ONLY ? "would change" : "to change"}, ${alreadyFixed} already correct (${corrections.length} total).`);
  if (CHECK_ONLY || pendingCount === 0) {
    await sql.end();
    process.exit(0);
  }

  const backup = [...before.values()].map(({ food_code, name_vi, extended_nutrients }) => ({ food_code, name_vi, extended_nutrients }));
  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 1));
  console.log(`Backed up ${backup.length} row(s) to ${BACKUP_PATH}.`);

  await sql.begin(async (tx) => {
    for (const [column, batch] of pendingByColumn) {
      const records = batch.map((c) => ({
        food_code: c.code,
        old_value: c.old === "" ? null : c.old,
        new_value: c.new === "" ? null : c.new,
      }));
      // The old-value guard makes a concurrent edit show up as a row-count mismatch, which rolls everything back.
      const result =
        column === "Food_Name_Vietnamese"
          ? await tx`
              update nutrition_items as n
              set name_vi = t.new_value
              from jsonb_to_recordset(${tx.json(records)}) as t(food_code text, old_value text, new_value text)
              where n.food_code = t.food_code and n.name_vi = t.old_value`
          : await tx`
              update nutrition_items as n
              set extended_nutrients = jsonb_set(n.extended_nutrients, array[${column}::text], coalesce(to_jsonb(t.new_value), 'null'::jsonb))
              from jsonb_to_recordset(${tx.json(records)}) as t(food_code text, old_value text, new_value text)
              where n.food_code = t.food_code and (n.extended_nutrients ->> ${column}::text) is not distinct from t.old_value`;
      if (result.count !== batch.length) {
        throw new Error(`${column}: updated ${result.count} row(s), expected ${batch.length} — transaction rolled back.`);
      }
      console.log(`  ${column}: updated ${result.count} row(s)`);
    }
  });

  const after = new Map((await selectRows()).map((r) => [r.food_code, r]));
  const wrong = corrections.filter((c) => currentValue(after.get(c.code), c.column) !== c.new);
  await sql.end();
  if (wrong.length > 0) {
    console.error(`Post-check failed for ${wrong.length} cell(s):`, wrong.slice(0, 10));
    process.exit(1);
  }
  console.log(`Done. All ${corrections.length} corrected cells verified in nutrition_items.`);
}
