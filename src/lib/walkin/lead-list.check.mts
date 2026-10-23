import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const exports: Record<string, unknown> = {};
const compiled = ts.transpileModule(readFileSync(new URL("./lead-list.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
runInNewContext(compiled, { exports, URLSearchParams, Date, require: (name: string) => name === "zod" ? nodeRequire("zod") : {} }, { timeout: 1000 });
const { budgetOf, filtersSchema, hidesClosed, listHref, pageWindow, relativeDays } = exports as typeof import("./lead-list");

const base = filtersSchema.parse({});
assert.equal(listHref(base), "/leads");
assert.equal(listHref(base, { brand: "TARAVILLE", page: 2 }), "/leads?brand=TARAVILLE&page=2");
assert.equal(listHref(base, { sort: "contact", dir: "asc" }), "/leads?sort=contact&dir=asc");
assert.equal(listHref({ ...base, q: "สม", page: 3 }, { page: undefined }), "/leads?q=%E0%B8%AA%E0%B8%A1");

assert.equal(listHref(base, { stage: "closed" }), "/leads?stage=closed");
assert.equal(listHref({ ...base, closed: "show" }, { page: 2 }), "/leads?closed=show&page=2");
assert.equal(filtersSchema.safeParse({ stage: "lost" }).success, false);
assert.equal(filtersSchema.safeParse({ closed: "hide" }).success, false);
// Closed leads are hidden by default, but a search, a stage filter or "show" brings them back.
assert.equal(hidesClosed(base), true);
assert.equal(hidesClosed({ ...base, q: "สม" }), false);
assert.equal(hidesClosed({ ...base, stage: "contacted" }), false);
assert.equal(hidesClosed({ ...base, closed: "show" }), false);

assert.equal(filtersSchema.safeParse({ sort: "name" }).success, false);
assert.equal(filtersSchema.safeParse({ from: "2026-10-02", to: "2026-10-01" }).success, false);

// 2026-10-23 12:00 Bangkok; 17:30Z on the 22nd is already the 23rd in Bangkok.
const now = new Date("2026-10-23T05:00:00Z");
assert.equal(relativeDays(null, now), "ยังไม่มี");
assert.equal(relativeDays("2026-10-22T17:30:00Z", now), "วันนี้");
assert.equal(relativeDays("2026-10-22T05:00:00Z", now), "เมื่อวาน");
assert.equal(relativeDays("2026-10-16T05:00:00Z", now), "7 วันก่อน");
assert.equal(relativeDays("2026-08-20T05:00:00Z", now), "2 เดือนก่อน");
assert.equal(relativeDays("2025-01-01T05:00:00Z", now), "1 ปีก่อน");

assert.equal(budgetOf({ survey: {} }), "—");
assert.equal(budgetOf({ survey: { budget_range: ["x"] } }), "—");
assert.equal(budgetOf({ survey: { budget_range: "2-3 ล้านบาท" } }), "2-3 ล้านบาท");

assert.deepEqual([...pageWindow(1, 1)], [1]);
assert.deepEqual([...pageWindow(1, 5)], [1, 2, 3, 4, 5]);
assert.deepEqual([...pageWindow(10, 20)], [1, null, 8, 9, 10, 11, 12, null, 20]);
console.log("PASS: lead list helpers");
