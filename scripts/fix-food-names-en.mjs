// One-time data-quality fix: data/seed/vietnam_food_composition_2007.csv's
// Food_Name_English column carries 13 values that are not English food names.
// Unlike the Vietnamese-column corruption (see fix-food-names-vi.mjs), this is
// not a glyph problem — it is the digitizer filling a blank.
//
// Every one of these entries leaves the "Tên tiếng Anh (English):" field EMPTY
// on its detail page in the source document (data/VTN_FCT_2007.pdf), verified
// page by page. The extractor then picked up whatever text sat nearest:
//
//   * 10 rows got "M· sè:" — the TCVN3-encoded Vietnamese header "Mã số:"
//     ("Code:") lifted off the group's table-of-contents page, not a name at all.
//   * 2 rows got "-", the source's own printed placeholder for "no English name".
//   * 1 row (7063) is the sole real value: the source prints "Pa tê", which the
//     legacy TCVN3 font encoding rendered as "Pa tª". Normalised to the English
//     spelling "Pate".
//
// The 12 blanks become empty fields, which import-nutrition-items.mjs maps to
// NULL (`r.Food_Name_English?.trim() || null`). NULL is the honest value here
// and matches how the schema already treats absent source data — see the
// nutrition_items comment: "NULL means 'not measured in the 2007 table', never
// coerced to 0". VietSearch falls back to the Vietnamese name for these.
//
// Same line-splice approach as fix-food-names-vi.mjs, so nothing outside the
// targeted rows' Food_Name_English bytes can change.
//
// Usage:
//   node scripts/fix-food-names-en.mjs           # apply to the CSV
//   node scripts/fix-food-names-en.mjs --check   # dry run, report only
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CSV_PATH = "data/seed/vietnam_food_composition_2007.csv";
const CHECK_ONLY = process.argv.includes("--check");

// food_code -> [expectedOldValue, newValue]. "" means "no English name in the
// source", which the importer turns into NULL.
export const CORRECTIONS = {
  "4064": ["M· sè:", ""], // Quả dọc
  "5013": ["M· sè:", ""], // Dưa lê
  "5043": ["-", ""], // Quả cóc
  "5045": ["-", ""], // Quả trứng gà
  "7043": ["M· sè:", ""], // Gân chân bò
  "7063": ["Pa tª", "Pate"], // Ba tê — source prints "Pa tê"
  "7072": ["M· sè:", ""], // Nem chạo
  "7074": ["M· sè:", ""], // Ruốc thịt lợn
  "8005": ["M· sè:", ""], // Cá dầu
  "8013": ["M· sè:", ""], // Cá lác
  "8016": ["M· sè:", ""], // Cá mì
  "8017": ["M· sè:", ""], // Cá mối
  "8027": ["M· sè:", ""], // Cá thu đao
};

function readField(line, i) {
  const start = i;
  if (line[i] === '"') {
    let j = i + 1;
    let value = "";
    while (j < line.length) {
      if (line[j] === '"') {
        if (line[j + 1] === '"') {
          value += '"';
          j += 2;
          continue;
        }
        j += 1;
        break;
      }
      value += line[j];
      j++;
    }
    return { value, start, end: j };
  }
  let j = i;
  while (j < line.length && line[j] !== ",") j++;
  return { value: line.slice(start, j), start, end: j };
}

function quoteField(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const raw = readFileSync(CSV_PATH, "utf8");
  const lines = raw.split("\n");
  const remaining = new Set(Object.keys(CORRECTIONS));
  let changed = 0;
  let alreadyApplied = 0;

  const outLines = lines.map((line, idx) => {
    if (idx === 0 || line.length === 0) return line; // header / trailing blank

    // STT and Food_Code (fields 0 and 1) are always bare numerics in this file.
    const firstComma = line.indexOf(",");
    const secondComma = line.indexOf(",", firstComma + 1);
    if (firstComma === -1 || secondComma === -1) return line;
    const foodCode = line.slice(firstComma + 1, secondComma);

    const correction = CORRECTIONS[foodCode];
    if (!correction) return line;

    // Food_Name_Vietnamese may be quoted and contain commas, so walk it rather
    // than counting commas to reach Food_Name_English.
    const viField = readField(line, secondComma + 1);
    if (line[viField.end] !== ",") {
      throw new Error(`Row ${idx + 1} (food_code ${foodCode}): malformed CSV after Food_Name_Vietnamese. Aborting.`);
    }
    const field = readField(line, viField.end + 1);

    const [expectedOld, newValue] = correction;
    remaining.delete(foodCode);
    if (field.value === newValue) {
      alreadyApplied++;
      return line; // already applied by a previous run
    }
    if (field.value !== expectedOld) {
      throw new Error(
        `Row ${idx + 1} (food_code ${foodCode}): expected Food_Name_English ` +
          `${JSON.stringify(expectedOld)}, found ${JSON.stringify(field.value)}. Aborting — no changes written.`,
      );
    }

    changed++;
    return line.slice(0, field.start) + quoteField(newValue) + line.slice(field.end);
  });

  if (remaining.size > 0) {
    throw new Error(`food_code(s) never matched a row: ${[...remaining].join(", ")}. Aborting — no changes written.`);
  }

  console.log(
    `${changed}/${Object.keys(CORRECTIONS).length} corrections matched and ${CHECK_ONLY ? "would be applied" : "applied"}` +
      (alreadyApplied ? ` (${alreadyApplied} already applied)` : "") +
      ".",
  );

  if (!CHECK_ONLY) {
    writeFileSync(CSV_PATH, outLines.join("\n"));
    console.log(`Wrote ${CSV_PATH}.`);
  }
}
