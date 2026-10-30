import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { SurveyQuestion } from "./survey-questions";

const nodeRequire = createRequire(import.meta.url);
function load(path: string) {
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const require = (name: string) => name.endsWith(".css") ? {} : nodeRequire(name);
  runInNewContext(compiled, { exports, require }, { timeout: 1000 });
  return exports;
}
const catalog = load("./survey-questions.ts") as typeof import("./survey-questions");
const { SurveyField } = load("../../app/walkin/survey-field.tsx") as typeof import("../../app/walkin/survey-field");
const question = (key: string): SurveyQuestion => {
  const result = catalog.SURVEY_QUESTIONS.BAAN_KUNAPAP.find(item => item.key === key);
  assert.ok(result, `Missing BK question: ${key}`);
  return result;
};
const render = (key: string, answers: Record<string, string | string[]> = {}) =>
  renderToStaticMarkup(createElement(SurveyField, { question: question(key), answers }));
const inputs = (html: string) => html.match(/<input\b[^>]*>/g) ?? [];

const newHouse = render("house_type");
assert.ok(!newHouse.includes('value="คอนโด"'), "New house choices must exclude condo");
assert.ok(newHouse.includes('value="รีโนเวท / ต่อเติม / ซ่อมแซม"'), "New house choices must include the combined renovation choice");
const oldHouse = render("house_type", { house_type: "คอนโด" });
const condo = inputs(oldHouse).find(input => input.includes('value="คอนโด"'));
assert.ok(condo?.includes('checked=""'), "Existing condo answers must render selected and remain submitted");
assert.ok(oldHouse.includes("คอนโด (ข้อมูลเดิม)"), "The retired choice must be identified as historical");

const payment = inputs(render("payment_method"));
assert.equal(payment.length, 2, "Financing has exactly two choices");
for (const [index, value] of ["เงินสด", "สินเชื่อธนาคาร"].entries()) {
  assert.ok(payment[index].includes('type="radio"') && payment[index].includes('name="survey.payment_method"'));
  assert.ok(payment[index].includes(`value="${value}"`));
  assert.ok(!/\brequired\b|\bchecked\b/.test(payment[index]), "Financing must remain optional with no answer preselected");
}

assert.equal(render("monthly_installment"), "", "A retired question without an answer must not render");
const legacy = render("monthly_installment", { monthly_installment: "6,000-8,000" });
const legacyInputs = inputs(legacy);
assert.equal(legacyInputs.length, 1, "The old answer is preserved with a single input, not a new set of choices");
assert.ok(legacyInputs[0].includes('name="survey.monthly_installment"') && legacyInputs[0].includes('value="6,000-8,000"'));
assert.match(legacyInputs[0], /\breadonly\b/i);
assert.ok(!legacy.includes('type="radio"'), "Retired installment choices must not be offered again");

const other = inputs(render("occupation", { occupation: "อื่นๆ", occupation_other: "เกษตรกร" }));
assert.ok(other.some(input => input.includes('value="อื่นๆ"') && input.includes('checked=""')));
const otherText = other.find(input => input.includes('name="survey.occupation_other"'));
assert.ok(otherText);
assert.ok(otherText.includes('value="เกษตรกร"'));
assert.match(otherText, /\bmaxlength="4000"/i);
assert.ok(!/\brequired\b/.test(otherText), "Occupation detail remains optional");
const address = render("address", { address: "สถานที่ก่อสร้างทดสอบ" });
assert.ok(address.includes("ที่อยู่ก่อสร้าง") && address.includes('name="survey.address"') && address.includes('value="สถานที่ก่อสร้างทดสอบ"'));
console.log("PASS: actual BK SurveyField markup for revised choices, optional financing and preserved historical answers");
// Mocked server rendering only; browser interaction, submit/reload and physical-device layout remain unverified.
