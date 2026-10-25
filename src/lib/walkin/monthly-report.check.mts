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
const { currentMonth, monthLabel, reportFiltersSchema } = load("./monthly-report.ts",
  name => name === "zod" ? nodeRequire("zod") : name === "./lead-stage" ? stageModule : {}) as typeof import("./monthly-report");

// 2026-09-30 18:00 UTC is already 1 October in Bangkok.
assert.equal(currentMonth(new Date("2026-09-30T18:00:00Z")), "2026-10");
assert.equal(currentMonth(new Date("2026-09-30T16:59:00Z")), "2026-09");
assert.equal(monthLabel("2026-10"), "ตุลาคม 2569");
assert.equal(reportFiltersSchema.safeParse({ month: "2026-13" }).success, false);
assert.equal(reportFiltersSchema.safeParse({ month: "2026-10", brand: "TARAVILLE" }).success, true);
assert.equal(reportFiltersSchema.safeParse({ brand: "OTHER" }).success, false);
console.log("PASS: monthly report helpers");
