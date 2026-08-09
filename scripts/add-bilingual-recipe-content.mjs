// One-time content migration for the i18n pass: splits data/seed/recipes.json's
// ingredient names (already authored as "Vietnamese (English)") into
// {name_vi, name_en, amount_vi, amount_en}, and adds an instructions_vi field
// per recipe with hand-authored natural Vietnamese translations.
//
// Does NOT touch calories/protein_g/carb_g/fat_g/name_vi/name_en/diet_tags/
// allergen_tags/source — only adds new text fields and restructures
// ingredients. Run once, then `git diff` to confirm no numeric changes.
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/seed/recipes.json";
const recipes = JSON.parse(readFileSync(PATH, "utf8"));

const AMOUNT_VI = {
  "to taste": "vừa đủ",
  "1 medium": "1 quả cỡ vừa",
  "1 egg": "1 quả",
  "2 medium": "2 quả cỡ vừa",
  "4 sheets": "4 tấm",
  "mixed filling": "nhân thập cẩm",
  "2 cloves": "2 tép",
  "1 packet": "1 gói",
  "1 ear (~250g)": "1 bắp (~250g)",
  "1 medium (~150g)": "1 quả cỡ vừa (~150g)",
  "1 whole fish (~400g)": "1 con nguyên con (~400g)",
  "4-5 segments (~150g)": "4-5 múi (~150g)",
  "1 wedge (~150g)": "1 miếng (~150g)",
  "1 wedge (~20g)": "1 miếng (~20g)",
  "4-5": "4-5 quả",
};

function splitIngredientName(name) {
  const m = name.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) throw new Error(`Ingredient name doesn't match "Vietnamese (English)" pattern: ${name}`);
  return { nameVi: m[1].trim(), nameEn: m[2].trim() };
}

function translateAmount(amount) {
  if (amount in AMOUNT_VI) return AMOUNT_VI[amount];
  // Numeric/measurement amounts (e.g. "200g", "500ml", "3") are language-neutral.
  return amount;
}

const INSTRUCTIONS_VI = {
  "Phở bò":
    "Hầm xương bò lấy nước dùng (hoặc dùng nước dùng đóng sẵn). Trụng bánh phở. Thái mỏng thịt bò sống, xếp lên trên bánh phở rồi chan nước dùng đang sôi để làm chín thịt. Rắc hành lá, ngò, giá đỗ lên trên.",
  "Bánh mỳ ốp la":
    "Chiên trứng ốp la. Xẻ ổ bánh mì rồi kẹp trứng chiên vào cùng chút nước mắm và rau thơm.",
  "Xôi xéo":
    "Đồ chín gạo nếp. Đồ chín đậu xanh rồi tán nhuyễn, nắm thành khối, thái lát mỏng. Xới xôi ra đĩa, rắc đậu xanh, hành phi và rưới chút dầu ăn lên trên.",
  "Cháo gà": "Ninh gạo trong nước dùng gà đến khi nhuyễn thành cháo. Cho thịt gà xé, gừng, hành lá vào.",
  "Bún riêu": "Ninh nước dùng cà chua riêu cua, cho đậu hũ chiên vào. Ăn kèm bún.",
  "Bánh cuốn":
    "Hấp bột gạo thành lớp bánh mỏng, cuộn với nhân thịt heo băm và mộc nhĩ đã xào chín. Ăn kèm nước chấm.",
  "Bơ": "Bổ đôi quả bơ, ăn tươi, có thể rắc thêm chút muối hoặc vắt chanh.",
  "Cơm tấm sườn nướng":
    "Ướp và nướng sườn heo. Ăn cùng cơm tấm, trứng ốp la, mỡ hành, dưa leo, cà chua và nước mắm.",
  "Bún chả Hà Nội":
    "Nướng thịt heo đã ướp. Ăn cùng bún, rau sống và nước chấm chua ngọt kèm đu đủ xanh.",
  "Đùi gà rán": "Chiên ngập dầu đùi gà đến khi giòn và chín đều. Ăn cùng cơm trắng và đồ chua.",
  "Bún bò Huế": "Ninh nước dùng sả và mắm ruốc cùng thịt bò và giò heo. Ăn kèm bún to.",
  "Đậu hũ sốt cà chua": "Chiên đậu hũ vàng đều rồi om trong sốt cà chua. Ăn cùng cơm trắng.",
  "Cá thu sốt cà chua": "Áp chảo cá thu vàng đều rồi om nhanh trong sốt cà chua. Ăn cùng cơm trắng.",
  "Bánh đa cuốn thập cẩm":
    "Cuốn hỗn hợp tôm, thịt heo, bún và rau thơm trong bánh đa đã làm mềm. Ăn kèm nước chấm.",
  "Lươn om chuối đậu":
    "Om lươn với chuối xanh, đậu hũ và nghệ đến khi nước sốt sánh lại. Rắc tía tô lên trên.",
  "Thịt kho trứng": "Kho thịt ba chỉ và trứng luộc trong nước dừa và nước mắm đến khi mềm. Ăn cùng cơm.",
  "Rau muống xào tỏi": "Xào rau muống với tỏi trong dầu ăn. Ăn cùng cơm.",
  "Đậu que xào thịt bò":
    "Xào thịt bò săn lại, cho đậu que vào xào đến khi chín tới còn giòn. Ăn cùng cơm.",
  "Bí đỏ luộc": "Luộc bí đỏ cắt khúc đến khi mềm. Ăn cùng cơm.",
  "Gà Tần thuốc bắc": "Hầm gà với thuốc bắc, nấm và hạt sen đến khi mềm và thơm.",
  "Rau bí xào tỏi": "Xào rau bí (ngọn và lá bí đỏ) với tỏi trong dầu ăn. Ăn cùng cơm.",
  "Trứng đúc thịt rán":
    "Trộn trứng đánh tan với thịt heo băm và hành lá, chiên đến khi chín đông lại. Dùng không kèm cơm để giảm tinh bột.",
  "Chè đậu xanh": "Ninh đậu xanh đến khi mềm, cho đường vào, rưới chút nước cốt dừa lên trên.",
  "Ngô luộc": "Luộc ngô nguyên bắp đến khi chín mềm.",
  "Xoài": "Gọt vỏ và thái lát xoài tươi.",
  "Sữa chua nếp cẩm": "Xếp lớp sữa chua với nếp cẩm đã nấu chín và trộn chút đường.",
  "Đậu phụ kho nấm":
    "Chiên sơ đậu hũ đến khi hơi vàng. Cho nấm và chút nước tương vào, kho đến khi nấm mềm và nước sốt sánh lại.",
  "Đậu phụ luộc chấm tương":
    "Luộc sơ đậu hũ đến khi nóng đều. Ăn cùng cơm trắng và nước chấm tương ớt chanh.",
  "Bánh cuốn chay chả":
    "Hấp bột gạo thành lớp bánh mỏng, cuộn với nhân chả chay và nấm đã xào chín. Ăn kèm nước chấm.",
  "Thịt bò xào su su": "Xào thịt bò săn lại, cho su su thái lát vào xào đến khi chín tới còn giòn.",
  "Tôm nướng": "Xiên tôm rồi nướng đến khi chín hồng và hơi cháy cạnh. Ăn cùng muối ớt xanh.",
  "Nộm bò khô":
    "Trộn đu đủ xanh bào sợi với thịt bò khô và nước trộn chua ngọt cay. Rắc đậu phộng rang giã và rau thơm lên trên.",
  "Xôi đỗ xanh": "Đồ gạo nếp cùng đậu xanh đã ngâm đến khi chín mềm.",
  "Cháo đỗ xanh": "Ninh gạo cùng đậu xanh đến khi nhuyễn thành cháo.",
  "Cháo trai": "Ninh gạo thành cháo, cho thịt trai đã xào thơm vào, rắc hành lá.",
  "Cháo lươn cay": "Ninh gạo thành cháo cùng lươn xé sợi, nêm ớt và nghệ.",
  "Bún cá": "Ninh nước dùng cà chua thì là, cho cá chiên hoặc luộc vào. Ăn kèm bún.",
  "Bún thang": "Ninh nước dùng gà trong. Xếp thịt gà xé, trứng tráng thái sợi và giò lên trên bún.",
  "Bánh giò":
    "Khuấy bột gạo thành hỗn hợp sánh đặc, gói cùng nhân thịt heo băm và mộc nhĩ trong lá chuối, hấp đến khi chín.",
  "Thịt bò xào măng": "Xào thịt bò săn lại, cho măng thái lát vào xào đến khi nóng đều.",
  "Thịt bò xào nấm": "Xào thịt bò săn lại, cho nấm vào xào đến khi chín mềm.",
  "Thịt gà xào sả": "Xào thịt gà cùng sả và ớt đến khi thơm và chín đều.",
  "Cá rô phi rán": "Chiên nguyên con cá rô phi đến khi giòn và chín đều. Ăn cùng nước mắm chanh.",
  "Cua biển hấp": "Hấp cua đến khi chín hẳn. Ăn cùng muối tiêu chanh.",
  "Đậu phụ kho thịt": "Kho đậu hũ và thịt heo cùng nhau trong nước mắm caramel đến khi nước sốt sánh lại.",
  "Bò nướng": "Ướp thịt bò với sả và tỏi, nướng chín theo độ ưa thích.",
  "Cá trê nướng": "Ướp cá trê với nghệ và sả, nướng đến khi cháy cạnh và chín đều.",
  "Gà nướng": "Ướp gà rồi nướng đến khi chín đều và hơi cháy cạnh.",
  "Thịt bò kho": "Kho thịt bò và cà rốt trong nước sốt caramel ngũ vị đến khi mềm. Ăn cùng cơm.",
  "Ốc om chuối đậu": "Om ốc với chuối xanh, đậu hũ và nghệ đến khi nước sốt sánh lại.",
  "Rau cải xoong xào tỏi": "Xào rau cải xoong với tỏi trong dầu ăn. Ăn cùng cơm.",
  "Su hào xào": "Xào su hào thái lát với tỏi trong dầu ăn. Ăn cùng cơm.",
  "Đậu cove xào": "Xào đậu cove với tỏi trong dầu ăn. Ăn cùng cơm.",
  "Gan xào giá": "Xào gan thái lát vừa chín tới, cho giá đỗ vào xào nhanh tay. Ăn cùng cơm.",
  "Chuối tiêu": "Bóc vỏ và ăn tươi.",
  "Bưởi": "Bóc vỏ và tách múi.",
  "Dưa hấu": "Thái miếng và ăn lạnh.",
  "Ổi": "Rửa sạch và ăn tươi, thái lát.",
  "Chè sen": "Ninh hạt sen đến khi mềm, cho đường phèn vào nấu tan.",
  "Sữa đậu nành": "Dùng lạnh hoặc nóng.",
  "Sữa chua không đường": "Dùng lạnh.",
  "Phô mai tam giác": "Dùng trực tiếp.",
  "Đậu phụ rán": "Chiên đậu hũ vàng đều. Ăn cùng nước tương chấm.",
  "Trứng vịt luộc": "Luộc đến khi chín hẳn.",
  "Trứng chim cút luộc": "Luộc đến khi chín hẳn, bóc vỏ.",
  "Ốc đĩa luộc mắm": "Luộc ốc đến khi chín. Ăn cùng nước mắm gừng.",
  "Hàu nướng mọi": "Nướng hàu còn nguyên vỏ đến khi vừa chín tới. Rắc mỡ hành lên trên.",
};

let missing = 0;
for (const recipe of recipes) {
  recipe.ingredients = recipe.ingredients.map((ing) => {
    const { nameVi, nameEn } = splitIngredientName(ing.name);
    return {
      name_vi: nameVi,
      name_en: nameEn,
      amount_vi: translateAmount(ing.amount),
      amount_en: ing.amount,
    };
  });

  const instructionsVi = INSTRUCTIONS_VI[recipe.name_vi];
  if (!instructionsVi) {
    console.error(`Missing Vietnamese instructions for: ${recipe.name_vi}`);
    missing++;
    continue;
  }
  recipe.instructions_vi = instructionsVi;
}

if (missing > 0) {
  console.error(`${missing} recipe(s) missing instructions_vi — aborting write.`);
  process.exit(1);
}

writeFileSync(PATH, JSON.stringify(recipes, null, 2) + "\n");
console.log(`Updated ${recipes.length} recipes with bilingual ingredients + instructions_vi.`);
