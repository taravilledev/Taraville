import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
function loadSource(name: string, requireModule?: (name: string) => unknown) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(name, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(compiled, { exports, require: requireModule, TextEncoder }, { timeout: 1000 });
  return exports;
}
const catalog = loadSource("./survey-questions.ts");
const validation = loadSource("./validation.ts", (name) => {
  if (name === "zod") return nodeRequire("zod");
  if (name === "./survey-questions") return catalog;
  throw new Error(`Unexpected validation dependency: ${name}`);
}) as typeof import("./validation");
const { parseLeadForm, mutationContextSchema, mutationError } = validation;
const owner = "123e4567-e89b-42d3-a456-426614174000";
const requestId = "123e4567-e89b-42d3-a456-426614174001";
const leadId = "123e4567-e89b-42d3-a456-426614174002";
const createContext = { brand: "TARAVILLE", requestId };
function context(brand: "TARAVILLE" | "BAAN_KUNAPAP" = "TARAVILLE") {
  return mutationContextSchema.parse({ ...createContext, brand });
}
function form(entries: [string, string | Blob][] = []) {
  const result = new FormData();
  result.set("first_name", "ลูกค้าทดสอบ");
  result.set("phone", "0000000000");
  result.set("owner_id", owner);
  result.set("data_confirmed", "on");
  for (const [key, value] of entries) result.append(key, value);
  return result;
}
function plain(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

const emptySurvey = parseLeadForm(context(), form());
assert.deepEqual(plain(emptySurvey), {
  contact: { name_title: "", first_name: "ลูกค้าทดสอบ", last_name: "", phone: "0000000000", line_id: "" },
  owner, survey: { decision_factors: [] },
}, "Optional survey questions must not prevent confirmed lead creation");
const trimmed = form();
trimmed.set("first_name", "  ลูกค้าทดสอบ  ");
trimmed.set("phone", "  0000000000  ");
assert.equal(parseLeadForm(context(), trimmed).contact.first_name, "ลูกค้าทดสอบ");
assert.equal(parseLeadForm(context(), trimmed).contact.phone, "0000000000");
for (const key of ["first_name", "phone"]) {
  for (const value of ["", "   "]) {
    const invalid = form();
    invalid.set(key, value);
    assert.throws(() => parseLeadForm(context(), invalid), `${key} must contain non-whitespace text`);
  }
  const missing = form();
  missing.delete(key);
  assert.throws(() => parseLeadForm(context(), missing), `${key} is required`);
}
for (const value of ["", "off", "true"]) {
  const invalid = form();
  invalid.set("data_confirmed", value);
  assert.throws(() => parseLeadForm(context(), invalid), "Data acknowledgement must be checked");
}
const unchecked = form();
unchecked.delete("data_confirmed");
assert.throws(() => parseLeadForm(context(), unchecked));
unchecked.set("synthetic_only", "on");
assert.throws(() => parseLeadForm(context(), unchecked), "The retired field must not bypass data acknowledgement");
for (const value of ["", "not-a-uuid", "123e4567-e89b-42d3-a456"]) {
  const invalid = form();
  invalid.set("owner_id", value);
  assert.throws(() => parseLeadForm(context(), invalid), "Owner must be a valid UUID");
}

const thaiAnswers = parseLeadForm(context(), form([
  ["survey.gender", "หญิง"], ["survey.occupation", "พนักงานบริษัท"],
  ["survey.address", "ตำบลทดสอบ อำเภอทดสอบ"], ["survey.sales_staff", "ชื่อในแบบสอบถาม"],
]));
assert.equal(thaiAnswers.survey.gender, "หญิง");
assert.equal(thaiAnswers.survey.occupation, "พนักงานบริษัท");
assert.equal(thaiAnswers.survey.address, "ตำบลทดสอบ อำเภอทดสอบ");
assert.equal(thaiAnswers.survey.sales_staff, "ชื่อในแบบสอบถาม");
assert.equal(thaiAnswers.owner, owner, "Free-text survey staff must not replace the authenticated owner UUID");
for (const value of ["0", "0.50", "15000", "15000.25"]) {
  assert.equal(parseLeadForm(context(), form([["survey.monthly_installment", value]])).survey.monthly_installment, value);
}
assert.equal(parseLeadForm(context("BAAN_KUNAPAP"), form([
  ["survey.monthly_installment", "6,000-8,000"],
])).survey.monthly_installment, "6,000-8,000");
for (const value of ["-1", "1e3", "NaN", "Infinity", "1,000", " 15000 ", "1.", ".5", "6,000-8,000"]) {
  assert.throws(() => parseLeadForm(context(), form([["survey.monthly_installment", value]])), `Invalid number: ${value}`);
}
assert.throws(() => parseLeadForm(context("BAAN_KUNAPAP"), form([["survey.monthly_installment", "15000"]])));
assert.throws(() => parseLeadForm(context(), form([["survey.occupation", "พนักงานประจำ"]])));
assert.throws(() => parseLeadForm(context("BAAN_KUNAPAP"), form([["survey.occupation", "พนักงานบริษัท"]])));
assert.throws(() => parseLeadForm(context(), form([["survey.gender", "หญิง"], ["survey.gender", "หญิง"]])),
  "Duplicate single-value fields must not silently choose one answer");

const multi = parseLeadForm(context(), form([
  ["survey.decision_factors", "ทำเลที่ตั้ง"], ["survey.decision_factors", "ราคาที่เหมาะสม"],
  ["survey.decision_factors", "ทำเลที่ตั้ง"],
]));
assert.deepEqual(plain(multi.survey.decision_factors), ["ทำเลที่ตั้ง", "ราคาที่เหมาะสม"]);
assert.throws(() => parseLeadForm(context(), form([["survey.decision_factors", "invalid-option"]])));
const otherSingle = parseLeadForm(context(), form([["survey.channel", "อื่นๆ"], ["survey.channel_other", "งานแสดงบ้าน"]]));
assert.equal(otherSingle.survey.channel_other, "งานแสดงบ้าน");
const otherMulti = parseLeadForm(context("BAAN_KUNAPAP"), form([
  ["survey.layout", "อื่นๆ"], ["survey.layout_other", "ห้องทำงาน"],
]));
assert.equal(otherMulti.survey.layout_other, "ห้องทำงาน");
const staleOther = parseLeadForm(context(), form([
  ["survey.channel", "TikTok"], ["survey.channel_other", "คำตอบเก่าที่ไม่เลือกแล้ว"],
]));
assert.ok(!Object.hasOwn(staleOther.survey, "channel_other"), "Stale unselected Other must be omitted");
const staleMultiOther = parseLeadForm(context("BAAN_KUNAPAP"), form([
  ["survey.layout", "2 ห้องนอน"], ["survey.layout_other", "คำตอบเก่า"],
]));
assert.ok(!Object.hasOwn(staleMultiOther.survey, "layout_other"));
assert.throws(() => parseLeadForm(context(), form([["survey.unknown_key", "x"]])));
assert.throws(() => parseLeadForm(context(), form([["survey.gender_other", "x"]])), "Unsupported Other keys must be rejected");
assert.throws(() => parseLeadForm(context(), form([
  ["survey.channel_other", "one"], ["survey.channel_other", "two"],
])), "Duplicate Other text must not silently choose a value");

for (const key of ["first_name", "owner_id", "data_confirmed", "survey.address", "survey.channel_other", "survey.decision_factors"]) {
  const invalid = form();
  invalid.set(key, new File(["synthetic"], "synthetic.txt", { type: "text/plain" }));
  assert.throws(() => parseLeadForm(context(), invalid), `File field must be rejected: ${key}`);
}
for (const [key, maximum] of [["name_title", 200], ["first_name", 200], ["last_name", 200], ["phone", 80], ["line_id", 200]] as const) {
  const boundary = form();
  boundary.set(key, "x".repeat(maximum));
  assert.equal(parseLeadForm(context(), boundary).contact[key], "x".repeat(maximum));
  boundary.set(key, "x".repeat(maximum + 1));
  assert.throws(() => parseLeadForm(context(), boundary), `${key} exceeds its length boundary`);
}
assert.equal(parseLeadForm(context(), form([["survey.address", "x".repeat(4000)]])).survey.address, "x".repeat(4000));
assert.throws(() => parseLeadForm(context(), form([["survey.address", "x".repeat(4001)]])));
assert.throws(() => parseLeadForm(context(), form([
  ["survey.channel", "อื่นๆ"], ["survey.channel_other", "x".repeat(4001)],
])));
assert.throws(() => parseLeadForm(context(), form([
  ["survey.address", "ไทย".repeat(1300)], ["survey.sales_staff", "ไทย".repeat(1300)],
  ["survey.channel", "อื่นๆ"], ["survey.channel_other", "ไทย".repeat(1300)],
])), "Total encoded survey bytes must be bounded even when individual strings fit");

assert.deepEqual(plain(mutationContextSchema.parse(createContext)), createContext);
assert.equal(mutationContextSchema.parse({ ...createContext, id: leadId, version: 1 }).version, 1);
assert.equal(mutationContextSchema.parse({ ...createContext, id: leadId, version: Number.MAX_SAFE_INTEGER }).version, Number.MAX_SAFE_INTEGER);
for (const invalid of [
  { ...createContext, id: leadId }, { ...createContext, version: 1 },
  { ...createContext, id: "invalid", version: 1 }, { ...createContext, requestId: "invalid" },
  { ...createContext, brand: "OTHER" },
  ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1", null].map(version => ({ ...createContext, id: leadId, version })),
]) {
  assert.equal(mutationContextSchema.safeParse(invalid).success, false, "Invalid mutation context must be rejected");
}
assert.equal(mutationError("40001", "private database detail"), "ข้อมูลถูกแก้ไขไปแล้ว กรุณาเปิดรายการล่าสุดก่อนแก้ไขอีกครั้ง");
assert.equal(mutationError("PT409", "stale_lead"), "ข้อมูลถูกแก้ไขไปแล้ว กรุณาเปิดรายการล่าสุดก่อนแก้ไขอีกครั้ง");
assert.equal(mutationError("42501", "private database detail"), "คุณไม่มีสิทธิ์แก้ไขรายการนี้ หรือสิทธิ์เพิ่งเปลี่ยน กรุณาเปิดรายการใหม่");
assert.equal(mutationError("22023", "request_conflict"), "คำขอนี้ถูกบันทึกไปแล้วด้วยข้อมูลต่างกัน กรุณาตรวจรายการก่อนเริ่มใหม่");
assert.equal(mutationError("22023", "invalid_owner"), "ข้อมูลหรือผู้ดูแลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่");
const genericError = "บันทึกไม่สำเร็จ กรุณาลองส่งซ้ำจากฟอร์มเดิม หากยังไม่ได้ให้ติดต่อผู้ดูแล";
assert.equal(mutationError(), genericError);
assert.equal(mutationError("XX000", "secret backend table and stack trace"), genericError);
assert.equal(mutationError(undefined, "secret backend table and stack trace"), genericError);
console.log("PASS: confirmed form validation, brand-specific surveys, mutation contexts and safe error messages");
console.log("Pure validation checks do not verify HTTP, authentication, database authorization, browser or device flows.");
