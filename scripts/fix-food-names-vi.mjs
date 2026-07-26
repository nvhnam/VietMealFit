// One-time data-quality fix: data/seed/vietnam_food_composition_2007.csv's
// Food_Name_Vietnamese column was digitized from the original 2007 source
// with a systematic diacritic-corruption bug (a handful of accented-vowel
// glyphs collide onto the wrong Unicode codepoint, e.g. "lợn" -> "lổn",
// "dầu" -> "dỗu", "kẹo" -> "kếo") — not random noise, a small set of
// confusable substitutions repeated ~150 times across the table. Each
// correction below was reconstructed from Vietnamese vocabulary + the
// paired English gloss already in the same row, then cross-checked for
// consistency against every other instance of the same corrupted glyph.
//
// This script is line-splice based (not a full CSV parse+stringify
// round-trip) specifically so it cannot alter anything except the
// Food_Name_Vietnamese field's bytes on the targeted rows — every other
// byte in the file, including quoting/number formatting on untouched
// fields and rows, is passed through unchanged.
//
// Usage:
//   node scripts/fix-food-names-vi.mjs           # apply to the CSV
//   node scripts/fix-food-names-vi.mjs --check    # dry run, report only
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CSV_PATH = "data/seed/vietnam_food_composition_2007.csv";
const CHECK_ONLY = process.argv.includes("--check");

// food_code -> [expectedOldValue, newValue]
export const CORRECTIONS = {
  "1018": ["Bột mị", "Bột mì"],
  "1022": ["Mỳ sổi", "Mỳ sợi"],
  "2001": ["Củ ốu", "Củ ấu"],
  "3021": ["Bột đậu tương đã loại bềo (đậu nành)", "Bột đậu tương đã loại béo (đậu nành)"],
  "3029": ["Hạt dưa đỏ rang (dưa hốu)", "Hạt dưa đỏ rang (dưa hấu)"],
  "3030": ["Hạt điều khô, chiên dỗu", "Hạt điều khô, chiên dầu"],
  "4001": ["Bỗu", "Bầu"],
  "4017": ["Cỗn ta", "Cần ta"],
  "4018": ["Cỗn tây", "Cần tây"],
  "4024": ["Củ niổng", "Củ niễng"],
  "4034": ["Gốc", "Gấc"],
  "4058": ["Ngô bao tợ", "Ngô bao tử"],
  "4061": ["ớt đỏ to", "Ớt đỏ to"],
  "4062": ["ớt vàng to", "Ớt vàng to"],
  "4063": ["ớt xanh to", "Ớt xanh to"],
  "4071": ["Rau giốp cá, diếp cá", "Rau giấp cá, diếp cá"],
  "4095": ["Sốu xanh", "Sấu xanh"],
  "4121": ["Mộc nhÜ", "Mộc nhĩ"],
  "4122": ["Nốm hương khô", "Nấm hương khô"],
  "4123": ["Nốm hương tươi", "Nấm hương tươi"],
  "4124": ["Nốm mì (Nốm tây)", "Nấm mỡ (Nấm tây)"],
  "4125": ["Nốm rơm", "Nấm rơm"],
  "4126": ["Nốm thường tươi", "Nấm thường tươi"],
  "5011": ["Dưa hốu", "Dưa hấu"],
  "5019": ["Hồng bị", "Hồng bì"],
  "5025": ["Mãng cỗu xiêm", "Mãng cầu xiêm"],
  "5033": ["Muçm, quềo", "Muỗm, quéo"],
  "5040": ["ổi", "Ổi"],
  "5046": ["Quốt chín (cả vỏ)", "Quất chín (cả vỏ)"],
  "5048": ["Sỗu riêng", "Sầu riêng"],
  "5049": ["Sốu chín", "Sấu chín"],
  "6002": ["Dỗu thảo mộc (Lạc, vừng, cám...)", "Dầu thảo mộc (Lạc, vừng, cám...)"],
  "6003": ["Mì lổn muối", "Mỡ lợn muối"],
  "6004": ["Mì lổn nước", "Mỡ lợn nước"],
  "6005": ["Bơ thùc vật", "Bơ thực vật"],
  "6006": ["Dỗu bông", "Dầu bông"],
  "6007": ["Dỗu cám gạo", "Dầu cám gạo"],
  "6008": ["Dỗu cọ", "Dầu cọ"],
  "6009": ["Dỗu dừa", "Dầu dừa"],
  "6010": ["Dỗu đậu tương", "Dầu đậu tương"],
  "6011": ["Dỗu lạc", "Dầu lạc"],
  "6012": ["Dỗu mắ", "Dầu mè"],
  "6013": ["Dỗu ngô", "Dầu ngô"],
  "6014": ["Dỗu oliu", "Dầu oliu"],
  "7001": ["Thịt bê mì", "Thịt bê mỡ"],
  "7006": ["Thịt bò, lưng, nạc và mì", "Thịt bò, lưng, nạc và mỡ"],
  "7016": ["Thịt lổn mì", "Thịt lợn mỡ"],
  "7017": ["Thịt lổn nạc", "Thịt lợn nạc"],
  "7018": ["Thịt lổn nợa nạc, nợa mì", "Thịt lợn nửa nạc, nửa mỡ"],
  "7019": ["Thịt ngçng", "Thịt ngỗng"],
  "7020": ["Thịt ngùa", "Thịt ngựa"],
  "7029": ["Bỗu dục bò", "Bầu dục bò"],
  "7030": ["Bỗu dục lổn", "Bầu dục lợn"],
  "7031": ["Bị lổn", "Bì lợn"],
  "7032": ["Chân giò lổn", "Chân giò lợn"],
  "7034": ["Dạ dày lổn", "Dạ dày lợn"],
  "7035": ["Đỗu bò", "Đầu bò"],
  "7036": ["Đỗu lổn", "Đầu lợn"],
  "7038": ["Đuôi lổn", "Đuôi lợn"],
  "7041": ["Gan lổn", "Gan lợn"],
  "7044": ["Lưìi bò", "Lưỡi bò"],
  "7045": ["Lưìi lổn", "Lưỡi lợn"],
  "7046": ["Lòng lổn (ruột già)", "Lòng lợn (ruột già)"],
  "7047": ["Lòng lổn (ruột non)", "Lòng lợn (ruột non)"],
  "7049": ["óc bò", "Óc bò"],
  "7050": ["óc lổn", "Óc lợn"],
  "7052": ["Phổi lổn", "Phổi lợn"],
  "7053": ["Sườn lổn", "Sườn lợn"],
  "7054": ["Tai lổn", "Tai lợn"],
  "7057": ["Tim lổn", "Tim lợn"],
  "7059": ["Tiết lổn luộc", "Tiết lợn luộc"],
  "7060": ["Tiết lổn sống", "Tiết lợn sống"],
  "7062": ["Tủy xương lổn", "Tủy xương lợn"],
  "7064": ["Chả lổn", "Chả lợn"],
  "7065": ["Chả quế lổn", "Chả quế lợn"],
  "7066": ["Dăm bông lổn", "Dăm bông lợn"],
  "7067": ["Dồi lổn", "Dồi lợn"],
  "7070": ["Giò thủ lổn", "Giò thủ lợn"],
  "7074": ["Ruốc thịt lổn", "Ruốc thịt lợn"],
  "7079": ["Châu chốu", "Châu chấu"],
  "7080": ["ếch (thịt đùi)", "Ếch (thịt đùi)"],
  "8003": ["Cá chềp", "Cá chép"],
  "8005": ["Cá dỗu", "Cá dầu"],
  "8014": ["Cá mắ", "Cá mè"],
  "8021": ["Cá phắn", "Cá phèn"],
  "8035": ["ghế", "Ghẹ"],
  "8039": ["Mùc khô", "Mực khô"],
  "8040": ["Mùc tươi", "Mực tươi"],
  "8041": ["ốc bươu", "Ốc bươu"],
  "8042": ["ốc đá", "Ốc đá"],
  "8043": ["ốc nhồi", "Ốc nhồi"],
  "8044": ["ốc vổn", "Ốc vặn"],
  "8049": ["Tềp gạo", "Tép gạo"],
  "8050": ["Tềp khô", "Tép khô"],
  "10003": ["Sữa mế (sữa người)", "Sữa mẹ (sữa người)"],
  "10005": ["Sữa chua vớt bềo", "Sữa chua vớt béo"],
  "10006": ["Sữa bột toàn phỗn", "Sữa bột toàn phần"],
  "10007": ["Sữa bột tách bềo", "Sữa bột tách béo"],
  "10008": ["Sữa đổc có đường Việt Nam", "Sữa đặc có đường Việt Nam"],
  "11004": ["Lạc chao dỗu", "Lạc chao dầu"],
  "11011": ["", "Mứt đu đủ"],
  "11021": ["Thịt vịt hỗm", "Thịt vịt hầm"],
  "12015": ["Kếo bơ cứng", "Kẹo bơ cứng"],
  "12016": ["Kếo cà phê", "Kẹo cà phê"],
  "12017": ["Kếo cam chanh", "Kẹo cam chanh"],
  "12018": ["Kếo dừa mềm", "Kẹo dừa mềm"],
  "12019": ["Kếo dứa mềm", "Kẹo dứa mềm"],
  "12020": ["Kếo lạc", "Kẹo lạc"],
  "12021": ["Kếo Pastille (kếo ngậm bạc hà)", "Kẹo Pastille (kẹo ngậm bạc hà)"],
  "12022": ["Kếo sô cô la", "Kẹo sô cô la"],
  "12023": ["Kếo sữa", "Kẹo sữa"],
  "12024": ["Kếo vừng viên", "Kẹo vừng viên"],
  "13010": ["Magi", "Maggi"],
  "13011": ["Mắm tôm đổc", "Mắm tôm đặc"],
  "13014": ["Nước mắm cá (loại đổc biệt)", "Nước mắm cá (loại đặc biệt)"],
  "13022": ["Xị dỗu", "Xì dầu"],
  "14007": ["Nước ềp cà chua", "Nước ép cà chua"],
  "14010": ["Rưổu cam, chanh (cồn 24,2 g)", "Rượu cam, chanh (cồn 24,2 g)"],
  "14011": ["Rưổu nếp (80g/ 24 ml) (cồn 5 g)", "Rượu nếp (80g/ 24 ml) (cồn 5 g)"],
  "14012": ["Rưổu trắng (cồn 39 g)", "Rượu trắng (cồn 39 g)"],
  "14013": ["Rưổu vang đỏ (cồn 9,5 g)", "Rượu vang đỏ (cồn 9,5 g)"],
  "14014": ["Rưổu vang trắng (cồn 9,5 g)", "Rượu vang trắng (cồn 9,5 g)"],
  "14015": ["Rưổu vang trắng ngọt (cồn 10.2 g)", "Rượu vang trắng ngọt (cồn 10.2 g)"],
  "14016": ["Rưổu Whisky (cồn 35,2 g)", "Rượu Whisky (cồn 35,2 g)"],
};

// Parses a quoted-or-bare CSV field starting at `i` in `line`. Returns
// { value, start, end } where [start,end) spans the raw field text
// (including quotes, if any) — NOT including the trailing delimiter.
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

// Only mutate the CSV when this file is run directly (`node
// scripts/fix-food-names-vi.mjs`) — not when another script imports it
// solely for the CORRECTIONS map (e.g. apply-food-name-fixes-db.mjs).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const raw = readFileSync(CSV_PATH, "utf8");
  const lines = raw.split("\n");
  const remaining = new Set(Object.keys(CORRECTIONS));
  let changed = 0;

  const outLines = lines.map((line, idx) => {
    if (idx === 0 || line.length === 0) return line; // header / trailing blank

    // STT and Food_Code (fields 0 and 1) are always bare numerics in this file.
    const firstComma = line.indexOf(",");
    const secondComma = line.indexOf(",", firstComma + 1);
    if (firstComma === -1 || secondComma === -1) return line;
    const foodCode = line.slice(firstComma + 1, secondComma);

    const correction = CORRECTIONS[foodCode];
    if (!correction) return line;

    const [expectedOld, newValue] = correction;
    const field = readField(line, secondComma + 1);
    if (field.value !== expectedOld) {
      throw new Error(
        `Row ${idx + 1} (food_code ${foodCode}): expected Food_Name_Vietnamese ` +
          `${JSON.stringify(expectedOld)}, found ${JSON.stringify(field.value)}. Aborting — no changes written.`,
      );
    }

    remaining.delete(foodCode);
    changed++;
    const newRaw = quoteField(newValue);
    return line.slice(0, field.start) + newRaw + line.slice(field.end);
  });

  if (remaining.size > 0) {
    throw new Error(`food_code(s) never matched a row: ${[...remaining].join(", ")}. Aborting — no changes written.`);
  }

  console.log(`${changed}/${Object.keys(CORRECTIONS).length} corrections matched and ${CHECK_ONLY ? "would be applied" : "applied"}.`);

  if (!CHECK_ONLY) {
    writeFileSync(CSV_PATH, outLines.join("\n"));
    console.log(`Wrote ${CSV_PATH}.`);
  }
}
