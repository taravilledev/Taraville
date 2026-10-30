import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

class MockHTMLElement {
  isVisible: boolean;
  constructor(isVisible = true) { this.isVisible = isVisible; }
  getClientRects() { return this.isVisible ? [{}] : []; }
}
class MockRadioNodeList extends Array<MockHTMLElement> {}
type Entry = [string, unknown];
type Control = MockHTMLElement | MockRadioNodeList | null;
type Form = { entries: Entry[]; elements: { namedItem: (key: string) => Control } };
class MockFormData {
  form: Form;
  constructor(form: Form) { this.form = form; }
  [Symbol.iterator]() { return this.form.entries[Symbol.iterator](); }
}
const exports: Record<string, unknown> = {};
const source = readFileSync(new URL("../../app/walkin/consent-fields.tsx", import.meta.url), "utf8") + "\nexport { hasSurveyAnswer };\n";
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const require = (name: string) => {
  if (name === "react" || name === "react/jsx-runtime" || name.endsWith(".css")) return {};
  if (name === "@/lib/walkin/privacy") return { PRIVACY_NOTICE: {} };
  if (name === "./notice-dialog") return { NoticeLink: () => null };
  throw new Error(`Unexpected consent dependency: ${name}`);
};
runInNewContext(compiled, { exports, require, HTMLElement: MockHTMLElement, FormData: MockFormData }, { timeout: 1000 });
const hasSurveyAnswer = exports.hasSurveyAnswer as (form: Form) => boolean;
const visible = new MockHTMLElement();
const hidden = new MockHTMLElement(false);
function form(entries: Entry[], controls: Record<string, Control> = {}): Form {
  return { entries, elements: { namedItem: key => controls[key] ?? visible } };
}

assert.equal(hasSurveyAnswer(form([["survey.address", "Visible answer"]])), true);
for (const key of ["survey.occupation_other", "survey.channel_other", "survey.layout_other", "survey.preferred_location"]) {
  assert.equal(hasSurveyAnswer(form([[key, "Saved detail"]], { [key]: hidden })), false,
    `Hidden ${key} must not trigger the survey-consent warning`);
  assert.equal(hasSurveyAnswer(form([[key, "Saved detail"]], { [key]: visible })), true,
    `Visible ${key} must still trigger the warning`);
}
assert.equal(hasSurveyAnswer(form([
  ["survey.occupation_other", "Hidden detail"], ["survey.address", "Visible answer"],
], { "survey.occupation_other": hidden })), true, "A hidden detail must not mask another visible answer");
assert.equal(hasSurveyAnswer(form([])), false);
for (const value of ["", " ", "\t\n", { name: "synthetic-file" }]) {
  assert.equal(hasSurveyAnswer(form([["survey.address", value]])), false, "Only nonblank text answers count");
}
assert.equal(hasSurveyAnswer(form([["survey.sales_staff", "Staff name"]])), false);
assert.equal(hasSurveyAnswer(form([["first_name", "Contact name"], ["phone", "0000000000"], ["survey_consent", "yes"]])), false,
  "Contact and consent controls are not survey answers");
const selectedGroup = new MockRadioNodeList(visible, visible);
assert.equal(hasSurveyAnswer(form([["survey.decision_factors", "ทำเลที่ตั้ง"]], { "survey.decision_factors": selectedGroup })), true,
  "Selected checkbox groups returned as RadioNodeList still count");
assert.equal(hasSurveyAnswer(form([["survey.payment_method", "เงินสด"]], { "survey.payment_method": selectedGroup })), true,
  "Selected radio groups returned as RadioNodeList still count");
console.log("PASS: actual consent helper counts visible answers and selected groups while ignoring hidden details");
// Mocked DOM visibility only; CSS selector behavior and browser change events require browser verification.
