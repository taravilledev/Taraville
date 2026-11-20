import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const exports: Record<string, unknown> = {};
const compiled = ts.transpileModule(readFileSync(new URL("./lead-page.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
runInNewContext(compiled, { exports }, { timeout: 1000 });
const { primaryAction, workRows } = exports as typeof import("./lead-page");

assert.equal(primaryAction("open", 0), "open");
assert.equal(primaryAction("project", 1), "continue");
assert.equal(primaryAction("project", 2), null, "Two live Projects: no primary action");
assert.equal(primaryAction("project", 0), null, "Every Project finished: the section offers a new one");
assert.equal(primaryAction("closed", 0), null);
assert.equal(primaryAction("closed", 1), null);

type Rows = Parameters<typeof workRows>;
const project = (id: string, status: "active" | "cancelled") => ({ id, code: `BKP-${id}`, status } as Rows[2][number]);
const sale = (id: string, projectId: string | null, status: string, canOpen = true) =>
  ({ id: `sale-${id}`, code: `SC-${id}`, project_id: projectId, status, can_open: canOpen } as unknown as Rows[3]["cases"][number]);
const rows = workRows("lead", "BAAN_KUNAPAP", [project("1", "cancelled"), project("2", "active"), project("3", "active"), project("4", "active")],
  { canCreate: true, cases: [sale("a", "2", "contracted"), sale("b", "4", "completed")] });
assert.equal(rows.map(row => row.code).join(), "BKP-2,BKP-3,BKP-1,BKP-4", "Live Projects first, finished folded last");
assert.equal(rows[0].href, "/sales/sale-a");
assert.equal(rows[1].isHalfOpen, true, "A Project without a sale is half open");
assert.equal(rows[1].href, "/sales/new?lead=lead&project=3", "Retry goes to the sale form for that Project");
assert.equal(workRows("lead", "BAAN_KUNAPAP", [project("3", "active")], { canCreate: false, cases: [] })[0].href, undefined, "No retry link without the right to create");
assert.equal(workRows("lead", "BAAN_KUNAPAP", [project("2", "active")], { canCreate: true, cases: [sale("a", "2", "contracted", false)] })[0].href, undefined, "A sale the reader cannot open has no link");
const taraville = workRows("lead", "TARAVILLE", [], { canCreate: true, cases: [sale("x", null, "cancelled"), sale("y", null, "draft")] });
assert.equal(taraville.map(row => row.code).join(), "SC-y,SC-x");
console.log("PASS: Lead page primary action by stage");
