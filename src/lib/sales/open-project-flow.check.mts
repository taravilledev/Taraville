import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const id = (last: string) => `00000000-0000-4000-8000-00000000000${last}`;
const leadId = id("1"), projectId = id("2"), caseId = id("3"), requestId = id("4");
const project = { id: projectId, code: "BKP-TEST", status: "active", lead_id: leadId, version: 1,
  created_at: "2026-11-06", cancelled_at: null, cancelled_by: null, cancel_reason: null };
const calls: { name: string; input: Record<string, unknown> }[] = [];
let denyCase = false;
const mocks: Record<string, unknown> = {
  "server-only": {},
  "next/cache": { revalidatePath: () => {} },
  "next/navigation": { redirect: (path: string) => { throw new Error(path); } },
  "@/lib/supabase/staff": { requireStaff: async () => ({ supabase: {
    rpc: (name: string, input: Record<string, unknown>) => {
      calls.push({ name, input });
      return name === "walkin_open_project"
        ? { single: async () => ({ data: project, error: null }) }
        : { data: { id: caseId }, error: denyCase ? { code: "42501" } : null };
    },
  } }) },
};
function load(file: URL): Record<string, unknown> {
  const exports = {};
  const require = (name: string) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return load(new URL(`${name.slice(2)}.ts`, root));
    if (name.startsWith(".")) return load(new URL(`${name}.ts`, file));
    return nodeRequire(name);
  };
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(compiled, { exports, require, URL }, { timeout: 1000 });
  return exports;
}
const { openProject } = load(new URL("app/walkin/project-actions.ts", root)) as typeof import("../../app/walkin/project-actions");
const { createCase } = load(new URL("app/sales/actions.ts", root)) as typeof import("../../app/sales/actions");
const confirmation = new FormData();
const context = { id: leadId, version: 1, requestId };
assert.ok((await openProject(context, { error: "" }, confirmation)).error);
assert.equal(calls.length, 0, "Confirmation is required before opening a project");
confirmation.set("confirm_operation", "on");
denyCase = true;
assert.match((await openProject(context, { error: "" }, confirmation)).error, /เปิดโครงการ BKP-TEST แล้ว/);
denyCase = false;
await assert.rejects(openProject(context, { error: "" }, confirmation), { message: `/sales/${caseId}?task=design&feedback=sales_create_case` });
assert.equal(calls[1].input.p_request_id, calls[3].input.p_request_id, "Retry uses the same case creation key");
assert.equal(calls[3].input.p_project_id, projectId, "Case is linked to the exact opened project");
const plot = new FormData();
plot.set("lead_id", leadId);
plot.set("request_id", requestId);
plot.set("unit_id", id("5"));
await assert.rejects(createCase({ error: "" }, plot), { message: `/sales/${caseId}?task=reserve&feedback=sales_create_case` });
console.log("PASS: open Project confirmation, BKP next task and retry, Taraville next task");
