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
  const result = catalog.SURVEY_QUESTIONS.TARAVILLE.find(item => item.key === key);
  assert.ok(result, `Missing Taraville question: ${key}`);
  return result;
};
const render = (key: string, answers: Record<string, string | string[]> = {}) =>
  renderToStaticMarkup(createElement(SurveyField, { question: question(key), answers }));
const inputs = (html: string) => html.match(/<input\b[^>]*>/g) ?? [];

for (const [key, option] of [["house_type", "คอนโด"], ["budget_range", "3 ล้านขึ้นไป"], ["decision_time", "2 สัปดาห์"]]) {
  assert.ok(!render(key).includes(`value="${option}"`), `New ${key} choices must hide ${option}`);
  const saved = render(key, { [key]: option });
  const current = inputs(saved).find(input => input.includes(`value="${option}"`));
  assert.ok(current?.includes('checked=""'), `Saved ${option} must remain selected and submit its original value`);
  assert.ok(saved.includes(`${option} (ข้อมูลเดิม)`), "Retired choices must be identified as historical");
}
const budget = render("budget_range");
for (const option of ["1-2 ล้าน", "2.1-3 ล้าน", "3-4 ล้าน", "4 ล้านขึ้นไป"]) assert.ok(budget.includes(`value="${option}"`));
const factors = inputs(render("decision_factors", { decision_factors: ["ทำเลที่ตั้ง", "เชื่อมั่นในแบรนด์", "คุณภาพของวัสดุ"] }));
assert.equal(factors.length, 6);
for (const option of ["ทำเลที่ตั้ง", "เชื่อมั่นในแบรนด์", "คุณภาพของวัสดุ"]) {
  const input = factors.find(item => item.includes(`value="${option}"`));
  assert.ok(input?.includes('type="checkbox"') && input.includes('checked=""'), "New factors remain independently selectable");
}
const location = render("preferred_location", { decision_factors: ["ทำเลที่ตั้ง"], preferred_location: "ทำเลทดสอบ" });
assert.ok(location.includes("ทำเลที่สนใจ"));
const locationInput = inputs(location).find(input => input.includes('name="survey.preferred_location"'));
assert.ok(locationInput);
assert.ok(locationInput.includes('value="ทำเลทดสอบ"') && locationInput.includes('placeholder="หากเลือกทำเลที่ตั้ง โปรดระบุ"'));
assert.match(locationInput, /\bmaxlength="4000"/i);
assert.ok(!/\brequired\b/.test(locationInput), "Preferred location is optional even when location is selected");
const occupation = inputs(render("occupation", { occupation: "อื่นๆ", occupation_other: "เกษตรกร" }));
assert.ok(occupation.some(input => input.includes('value="อื่นๆ"') && input.includes('checked=""')));
const other = occupation.find(input => input.includes('name="survey.occupation_other"'));
assert.ok(other);
assert.ok(other.includes('value="เกษตรกร"'));
assert.match(other, /\bmaxlength="4000"/i);
assert.ok(!/\brequired\b/.test(other));
const reason = inputs(render("purchase_reason", { purchase_reason: "ซื้อเพื่อปล่อยเช่า" })).find(input => input.includes('value="ซื้อเพื่อปล่อยเช่า"'));
assert.ok(reason?.includes('type="radio"') && reason.includes('checked=""'));
console.log("PASS: actual Taraville SurveyField markup for revised options, optional location and preserved legacy selections");
// Server rendering only; browser interaction, submit/reload and physical-device layout remain unverified.
