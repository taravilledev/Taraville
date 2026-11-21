import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const exports: Record<string, unknown> = {};
const compiled = ts.transpileModule(readFileSync(new URL("./lead-stage.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
runInNewContext(compiled, { exports, require: (name: string) => nodeRequire(name) }, { timeout: 1000 });
const { STAGE_CODES, STAGE_GROUPS, STAGE_GROUP_CODES, STAGE_GROUP_LABELS, closeReasonsFor, parseCancelProjectForm, parseCloseForm, parseReopenForm, stageGroupLabel, stageGroupOf } = exports as typeof import("./lead-stage");

const context = { id: "00000000-0000-4000-8000-000000000001", version: 3, requestId: "00000000-0000-4000-8000-000000000002" };
const form = (fields: Record<string, string>) => Object.entries(fields).reduce((data, [key, value]) => (data.set(key, value), data), new FormData());

assert.equal(closeReasonsFor("TARAVILLE").includes("bought_with_us"), true);
assert.equal(closeReasonsFor("BAAN_KUNAPAP").includes("bought_with_us"), false);

assert.deepEqual({ ...parseCloseForm(context, form({ confirm_operation: "on", reason: "duplicate" })) }, { ...context, reason: "duplicate", text: null });
assert.equal(parseCloseForm(context, form({ confirm_operation: "on", reason: "other", reason_text: "  moved  " })).text, "moved");
assert.throws(() => parseCloseForm(context, form({ reason: "duplicate" })), "confirmation is required");
assert.throws(() => parseCloseForm(context, form({ confirm_operation: "on", reason: "nonsense" })));
assert.throws(() => parseCloseForm(context, form({ confirm_operation: "on", reason: "other" })), "other needs text");
assert.throws(() => parseCloseForm(context, form({ confirm_operation: "on", reason: "duplicate", reason_text: "x" })), "text only for other");
assert.throws(() => parseReopenForm(context, form({})));
assert.equal(parseReopenForm(context, form({ confirm_operation: "on" })).version, 3);
const cancel = { id: context.id, leadId: "00000000-0000-4000-8000-000000000003", version: 2, requestId: context.requestId };
assert.equal(parseCancelProjectForm(cancel, form({ confirm_operation: "on", reason: "  opened by mistake " })).reason, "opened by mistake");
assert.throws(() => parseCancelProjectForm(cancel, form({ confirm_operation: "on", reason: "   " })));
assert.throws(() => parseCancelProjectForm(cancel, form({ confirm_operation: "on", reason: "x".repeat(501) })));
assert.throws(() => parseCancelProjectForm(cancel, form({ reason: "mistake" })));
// The UI shows three groups: received and contacted are one "open" group, and "ติดต่อแล้ว" never appears (ADR 0059).
assert.deepEqual([...STAGE_CODES.map(stageGroupOf)], ["open", "open", "project", "closed"]);
assert.deepEqual([...STAGE_CODES.map(stageGroupLabel)], ["ยังไม่เปิดโครงการ", "ยังไม่เปิดโครงการ", "เปิดโครงการแล้ว", "ปิด"]);
assert.deepEqual([...STAGE_GROUPS.flatMap(group => STAGE_GROUP_CODES[group])], [...STAGE_CODES], "every stage code sits in exactly one group");
assert.equal(Object.values(STAGE_GROUP_LABELS).includes("ติดต่อแล้ว"), false);
console.log("PASS: lead stage close/reopen and project form parsing");
