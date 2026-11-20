import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

class IntakeForm {
  data = new FormData();
  hasOwnerSelect = false;
  querySelector(selector: string) {
    assert.equal(selector, 'select[name="owner_id"]');
    return this.hasOwnerSelect ? {} : null;
  }
}

const form = new IntakeForm();
let asked = false;
let shouldLeave = false;
const exports = {} as typeof import("../../app/walkin/change-brand-link");
const draft = {} as typeof import("../../app/walkin/form-draft");
const compile = (path: string) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const sandbox = {
  require: (name: string) => name === "react/jsx-runtime" ? jsxRuntime : name === "./form-draft" ? draft : { default: {} },
  HTMLFormElement: IntakeForm,
  FormData: function CurrentFormData(current: IntakeForm) {
    const data = new FormData();
    for (const [key, value] of current.data) data.append(key, value);
    return data;
  },
  document: { getElementById: () => form },
  window: { confirm: () => { asked = true; return shouldLeave; } },
};
runInNewContext(compile("../../app/walkin/form-draft.ts"), { ...sandbox, exports: draft }, { timeout: 1000 });
runInNewContext(compile("../../app/walkin/change-brand-link.tsx"), { ...sandbox, exports }, { timeout: 1000 });

function click(entries: [string, string][], hasOwnerSelect = false) {
  asked = false;
  form.data = new FormData();
  form.hasOwnerSelect = hasOwnerSelect;
  for (const [key, value] of entries) form.data.append(key, value);
  let stayed = false;
  exports.ChangeBrandLink({ formId: "lead-form" }).props.onClick({ preventDefault: () => { stayed = true; } });
  return { asked, stayed };
}

assert.deepEqual(click([["owner_id", "assigned"], ["first_name", " "], ["$ACTION_ID", "internal"]]), { asked: false, stayed: false });
for (const field of ["first_name", "name_title", "survey_consent", "survey.decision_factors", "intake_confirmed"]) {
  assert.deepEqual(click([[field, "selected"]]), { asked: true, stayed: true }, field);
}
assert.deepEqual(click([["owner_id", "selected"]], true), { asked: true, stayed: true });
shouldLeave = true;
assert.deepEqual(click([["survey.decision_factors", "selected"]]), { asked: true, stayed: false });
