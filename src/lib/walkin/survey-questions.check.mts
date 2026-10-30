import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function catalog(source: string) {
  const exports = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(compiled, { exports }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(exports)).SURVEY_QUESTIONS;
}

const demoPath = new URL("../../../../Taraville/src/components/walkin/WalkinSurveyForm.tsx", import.meta.url);
const demo = readFileSync(demoPath, "utf8");
const questionsOnly = demo.slice(demo.indexOf("type SurveyQuestion"), demo.indexOf("// budget_range"));
const current = readFileSync(new URL("./survey-questions.ts", import.meta.url), "utf8");

type Question = { key: string; label: string; kind: string; placeholder?: string; options?: string[]; legacy?: boolean; legacyOptions?: string[];
  dependsOn?: { key: string; option: string } };
type Catalog = Record<string, Question[]>;
const mine: Catalog = catalog(current);
const reference: Catalog = catalog(questionsOnly);
const tvChanged = new Set(["occupation", "house_type", "decision_factors", "preferred_location", "budget_range", "decision_time", "purchase_reason"]);
assert.deepEqual(mine.TARAVILLE.filter(q => !tvChanged.has(q.key)), reference.TARAVILLE.filter(q => !tvChanged.has(q.key)),
  "Unchanged Taraville questions must preserve demo labels, kinds, choices and relative order");
const tv = (key: string) => {
  const question = mine.TARAVILLE.find(q => q.key === key);
  assert.ok(question, `Missing Taraville question: ${key}`);
  return question;
};
const tvOriginal = (key: string) => reference.TARAVILLE.find(q => q.key === key);
assert.deepEqual(tv("occupation"), { ...tvOriginal("occupation"), options: ["เจ้าของธุรกิจ", "พนักงานบริษัท", "ข้าราชการ", "ค้าขาย", "อื่นๆ"] });
assert.deepEqual(tv("house_type"), { ...tvOriginal("house_type"), legacyOptions: ["คอนโด"] });
assert.deepEqual(tv("decision_factors"), { ...tvOriginal("decision_factors"), options: ["ทำเลที่ตั้ง", "ราคาที่เหมาะสม", "รูปแบบ", "ระบบรักษาความปลอดภัย", "เชื่อมั่นในแบรนด์", "คุณภาพของวัสดุ"] });
assert.deepEqual(tv("preferred_location"), { key: "preferred_location", label: "ทำเลที่สนใจ", kind: "text",
  placeholder: "หากเลือกทำเลที่ตั้ง โปรดระบุ", dependsOn: { key: "decision_factors", option: "ทำเลที่ตั้ง" } });
assert.deepEqual(tv("budget_range"), { ...tvOriginal("budget_range"), options: ["1-2 ล้าน", "2.1-3 ล้าน", "3-4 ล้าน", "4 ล้านขึ้นไป", "3 ล้านขึ้นไป"], legacyOptions: ["3 ล้านขึ้นไป"] });
assert.deepEqual(tv("decision_time"), { ...tvOriginal("decision_time"), legacyOptions: ["2 สัปดาห์"] });
assert.deepEqual(tv("purchase_reason"), { ...tvOriginal("purchase_reason"), options: ["ขยายครอบครัว", "ย้ายที่ทำงาน", "ซื้อเป็นทรัพย์สิน", "ซื้อเพื่อปล่อยเช่า"] });
assert.deepEqual(mine.TARAVILLE.map(q => q.key), ["address", "gender", "age_range", "occupation", "income_range", "house_type",
  "decision_factors", "preferred_location", "bedrooms", "budget_range", "monthly_installment", "channel", "decision_time", "purchase_reason", "sales_staff"],
  "Preferred location follows decision factors without renumbering existing questions");
const changed = new Set(["address", "occupation", "house_type", "budget_range", "payment_method", "channel", "monthly_installment"]);
assert.deepEqual(mine.BAAN_KUNAPAP.filter(q => !changed.has(q.key)), reference.BAAN_KUNAPAP.filter(q => !changed.has(q.key)),
  "Unchanged BK questions must preserve demo labels, kinds, choices and relative order");
const bk = (key: string) => {
  const question = mine.BAAN_KUNAPAP.find(q => q.key === key);
  assert.ok(question, `Missing BK question: ${key}`);
  return question;
};
assert.deepEqual(bk("address"), { ...reference.BAAN_KUNAPAP.find(q => q.key === "address"), label: "ที่อยู่ก่อสร้าง" });
assert.deepEqual(bk("occupation"), { key: "occupation", label: "3. อาชีพ", kind: "single",
  options: ["เจ้าของธุรกิจ", "พนักงานประจำ", "ข้าราชการ", "ค้าขาย", "อื่นๆ"] });
assert.deepEqual(bk("house_type").legacyOptions, ["คอนโด"]);
assert.deepEqual(bk("house_type").options?.filter(option => !bk("house_type").legacyOptions?.includes(option)),
  ["บ้านเดี่ยวชั้นเดียว", "บ้านเดี่ยว 2 ชั้น", "ทาวน์โฮมชั้นเดียว", "ทาวน์โฮม 2 ชั้น", "ทาวน์โฮม 3 ชั้น", "บ้านแฝด", "อาคารพาณิชย์", "รีโนเวท / ต่อเติม / ซ่อมแซม"]);
assert.ok(bk("house_type").options?.includes("คอนโด"), "Saved condo answers must remain accepted");
assert.deepEqual(bk("budget_range").options,
  ["ต่ำกว่า 500,000 บาท", "500,000-1,000,000 บาท", "1-2 ล้านบาท", "2-3 ล้านบาท", "3-4 ล้านบาท", "4 ล้านบาทขึ้นไป"]);
assert.deepEqual(bk("payment_method"), { key: "payment_method", label: "7. วิธีชำระเงิน", kind: "single", options: ["เงินสด", "สินเชื่อธนาคาร"] });
assert.deepEqual(bk("channel"), { ...reference.BAAN_KUNAPAP.find(q => q.key === "channel"),
  label: "8. ท่านรู้จักและสะดวกรับข้อมูลข่าวสารจากบริษัทฯ ทางช่องทางใด" });
assert.deepEqual(bk("monthly_installment"), { ...reference.BAAN_KUNAPAP.find(q => q.key === "monthly_installment"),
  label: "ค่างวดที่สะดวกในการผ่อนชำระต่อเดือน (บาท) (ข้อมูลเดิม)", legacy: true });
assert.deepEqual(mine.BAAN_KUNAPAP.filter(q => !q.legacy).map(q => q.key),
  ["address", "gender", "age_range", "occupation", "income_range", "house_type", "layout", "budget_range", "payment_method", "channel", "sales_staff"],
  "New BK forms must use financing before channel and omit the retired installment question");
console.log("PASS: scoped BK and Taraville revisions, dependency metadata and legacy compatibility");
