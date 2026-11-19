import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const writes: Record<string, unknown>[] = [];
const { saveDesign } = load("../../app/sales/money-actions.ts", {
  "@/lib/supabase/staff": { requireStaff: async () => ({}) },
  "@/lib/sales/money": load("./money.ts"),
  "@/lib/sales/design-fees": load("./design-fees.ts"),
  "@/lib/sales/financial-models": {},
  "@/lib/sales/mutations": { salesMutation: async (_session: unknown, name: string, args: Record<string, unknown>) => {
    assert.equal(name, "sales_save_design_plan"); writes.push(args); return { error: "" };
  } },
}) as typeof import("../../app/sales/money-actions");
const identity = { id: "00000000-0000-4000-a000-000000000001", version: 1, requestId: "00000000-0000-4000-a000-000000000002" };
for (const area of [undefined, "", "0", "0.000", "-1", "abc", "1.0001", "1000000000"]) {
  const form = new FormData(); form.set("tier", "under150");
  if (area !== undefined) form.set("usable_area", area);
  assert.ok((await saveDesign(identity, { error: "" }, form)).error, `Reject ${area}`);
}
assert.equal(writes.length, 0, "Missing or invalid area never reaches mutation");
const form = new FormData(); form.set("tier", "under150"); form.set("usable_area", "175.5");
assert.equal((await saveDesign(identity, { error: "" }, form)).error, "");
assert.equal(writes.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(writes[0].p_input)), { usable_area: "175.5", tier: "under200", note: "" });
console.log("PASS: actual design area required before mutation, positive precision validated, automatic tier retained");
