import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
function load(file: string, require: (name: string) => unknown) {
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(compiled, { exports, Date, require }, { timeout: 1000 });
  return exports;
}
const stageModule = load("./lead-stage.ts", name => nodeRequire(name));
const { currentMonth, monthLabel, reportFiltersSchema, summarizeSelectedLeads } = load("./monthly-report.ts",
  name => name === "zod" ? nodeRequire("zod") : name === "./lead-stage" ? stageModule : {}) as typeof import("./monthly-report");

// 2026-09-30 18:00 UTC is already 1 October in Bangkok.
assert.equal(currentMonth(new Date("2026-09-30T18:00:00Z")), "2026-10");
assert.equal(currentMonth(new Date("2026-09-30T16:59:00Z")), "2026-09");
assert.equal(monthLabel("2026-10"), "ตุลาคม 2569");
assert.equal(reportFiltersSchema.safeParse({ month: "2026-13" }).success, false);
assert.equal(reportFiltersSchema.safeParse({ month: "2026-10", brand: "TARAVILLE" }).success, true);
assert.equal(reportFiltersSchema.safeParse({ brand: "OTHER" }).success, false);
const selected = summarizeSelectedLeads([
  { brand: "TARAVILLE", is_synthetic: false, project_counts: { open: 2, closed: 1 } },
  { brand: "TARAVILLE", is_synthetic: false, project_counts: { open: 0, closed: 0 } },
  { brand: "BAAN_KUNAPAP", is_synthetic: false, project_counts: { open: 1, closed: 2 } },
  { brand: "BAAN_KUNAPAP", is_synthetic: true, project_counts: { open: 9, closed: 9 } },
]);
assert.equal(selected.byBrand.TARAVILLE.total, 2);
assert.equal(selected.byBrand.TARAVILLE.open, 2);
assert.equal(selected.byBrand.TARAVILLE.closed, 1);
assert.equal(selected.byBrand.BAAN_KUNAPAP.total, 1);
assert.equal(selected.byBrand.BAAN_KUNAPAP.open, 1);
assert.equal(selected.byBrand.BAAN_KUNAPAP.closed, 2);
assert.equal(selected.synthetic, 1);
assert.equal(summarizeSelectedLeads([]).byBrand.BAAN_KUNAPAP.total, 0);
assert.equal(summarizeSelectedLeads([
  { brand: "TARAVILLE", is_synthetic: false },
]).byBrand.TARAVILLE.hasProjectCounts, false);
console.log("PASS: selected monthly Leads and their project totals by brand");
