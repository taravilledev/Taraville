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
let navigatedTo = "";
const exports = {} as typeof import("../../app/walkin/change-brand-link");
const draft = {} as typeof import("../../app/walkin/form-draft");
const compile = (path: string) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const sandbox = {
  require: (name: string) => name === "react/jsx-runtime" ? jsxRuntime : name === "./form-draft" ? draft
    : name === "@/components/confirm-dialog" ? { useConfirm: () => ({ confirm: () => { asked = true; return Promise.resolve(shouldLeave); }, confirmDialog: null }) }
    : { default: {} },
  HTMLFormElement: IntakeForm,
  FormData: function CurrentFormData(current: IntakeForm) {
    const data = new FormData();
    for (const [key, value] of current.data) data.append(key, value);
    return data;
  },
  document: { getElementById: () => form },
  window: { location: { assign: (href: string) => { navigatedTo = href; } } },
};
runInNewContext(compile("../../app/walkin/form-draft.ts"), { ...sandbox, exports: draft }, { timeout: 1000 });
runInNewContext(compile("../../app/walkin/change-brand-link.tsx"), { ...sandbox, exports }, { timeout: 1000 });

async function click(entries: [string, string][], hasOwnerSelect = false) {
  asked = false;
  navigatedTo = "";
  form.data = new FormData();
  form.hasOwnerSelect = hasOwnerSelect;
  for (const [key, value] of entries) form.data.append(key, value);
  let stayed = false;
  const link = exports.ChangeBrandLink({ formId: "lead-form" }).props.children[0];
  link.props.onClick({ preventDefault: () => { stayed = true; }, currentTarget: { href: "/walkin" } });
  await Promise.resolve();
  return { asked, stayed, navigatedTo };
}

assert.deepEqual(await click([["owner_id", "assigned"], ["first_name", " "], ["$ACTION_ID", "internal"]]), { asked: false, stayed: false, navigatedTo: "" });
for (const field of ["first_name", "name_title", "survey_consent", "survey.decision_factors", "intake_confirmed"]) {
  assert.deepEqual(await click([[field, "selected"]]), { asked: true, stayed: true, navigatedTo: "" }, field);
}
assert.deepEqual(await click([["owner_id", "selected"]], true), { asked: true, stayed: true, navigatedTo: "" });
shouldLeave = true;
assert.deepEqual(await click([["survey.decision_factors", "selected"]]), { asked: true, stayed: true, navigatedTo: "/walkin" });
