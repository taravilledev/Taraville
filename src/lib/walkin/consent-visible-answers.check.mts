import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

let consent = false;
const imports: Record<string, unknown> = {
  react: { useState: () => [consent, (value: boolean) => { consent = value; }] },
  "react/jsx-runtime": jsxRuntime,
  "@/lib/walkin/privacy": { PRIVACY_NOTICE: { choices: {} } },
  "@/lib/walkin/phone": {},
  "@/lib/walkin/survey-questions": {
    SURVEY_QUESTIONS: { BAAN_KUNAPAP: [{ key: "test" }], TARAVILLE: [{ key: "test" }] },
  },
  "./notice-dialog": { NoticeDialog: () => null, NoticeLink: () => null },
  "./versioned-notice": { VersionedNotice: () => null },
  "./required-mark": { RequiredMark: () => null },
  "./actions": { saveLead: () => null },
  "./action-form": { ActionForm: ({ children }: { children: unknown }) => children },
  "./survey-field": { SurveyField: () => createElement("input", { name: "survey.test" }) },
};
function load(file: string) {
  const exports = {};
  const source = readFileSync(new URL("../../app/walkin/" + file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, { exports, require: (name: string) => {
    if (name.endsWith(".css")) return { default: {} };
    assert.ok(name in imports, "Unexpected dependency " + name);
    return imports[name];
  } }, { timeout: 1000 });
  return exports;
}

imports["./consent-fields"] = load("consent-fields.tsx");
const { LeadForm } = load("lead-form.tsx") as typeof import("../../app/walkin/lead-form");
const staff = { role: "sale", id: "staff" } as Parameters<typeof LeadForm>[0]["staff"];
for (const brand of ["BAAN_KUNAPAP", "TARAVILLE"] as const) {
  const props = { brand, staff, owners: [], requestId: "test" };
  const render = () => renderToStaticMarkup(createElement(LeadForm, props));
  consent = false;
  const beforeConsent = render();
  assert.equal((beforeConsent.match(/name="survey_consent"/g) ?? []).length, 1);
  assert.match(beforeConsent, /<fieldset id="survey-questions" disabled="" hidden="">/);
  const followup = beforeConsent.match(/<input[^>]*name="intake_confirmed"[^>]*>/)?.[0] ?? "";
  assert.match(followup, /required=""/);
  consent = true;
  assert.match(render(), /<fieldset id="survey-questions">/);
  const lead = { id: "lead", survey: {}, version: 1 } as Parameters<typeof LeadForm>[0]["lead"];
  const edit = renderToStaticMarkup(createElement(LeadForm, { ...props, lead, choice: true }));
  assert.match(edit, /name="survey.test"/);
  assert.doesNotMatch(edit, /name="survey_consent"/);
  const optedOut = renderToStaticMarkup(createElement(LeadForm, { ...props, lead, choice: false }));
  assert.doesNotMatch(optedOut, /name="survey.test"/);
}
console.log("PASS: consent gates survey fields on both intake forms and preserves editing rules");
