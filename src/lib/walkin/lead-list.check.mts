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
  runInNewContext(compiled, { exports, URLSearchParams, Date, require }, { timeout: 1000 });
  return exports;
}
const stageModule = load("./lead-stage.ts", name => nodeRequire(name));
const questionModule = load("./survey-questions.ts", () => ({}));
const exports = load("./lead-list.ts", name => name === "zod" ? nodeRequire("zod") : name === "./lead-stage" ? stageModule : name === "./survey-questions" ? questionModule : {});
const { activeSurveyFilters, budgetOf, filtersSchema, instalmentClause, listHref, pageWindow, panelFilterCount, registrationRange, relativeDays, stageTab, surveyFilterOptions } = exports as typeof import("./lead-list");

// Values built inside the vm carry its own prototypes; compare them as plain JSON.
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const base = filtersSchema.parse({});
assert.equal(listHref(base), "/leads");
assert.equal(listHref(base, { brand: "TARAVILLE", page: 2 }), "/leads?brand=TARAVILLE&page=2");
assert.equal(listHref(base, { dir: "asc" }), "/leads?dir=asc");
assert.equal(listHref({ ...base, q: "สม", page: 3 }, { page: undefined }), "/leads?q=%E0%B8%AA%E0%B8%A1");

// Stage tabs: a group, "all", or an old stage code that maps to its group.
assert.equal(listHref(base, { stage: "closed" }), "/leads?stage=closed");
assert.equal(listHref(base, { stage: "all" }), "/leads?stage=all");
for (const [code, group] of [["received", "open"], ["contacted", "open"], ["project_opened", "project"], ["closed", "closed"], ["open", "open"], ["project", "project"], ["all", "all"]]) {
  assert.equal(filtersSchema.parse({ stage: code }).stage, group, `?stage=${code}`);
}
assert.equal(filtersSchema.safeParse({ stage: "lost" }).success, false);
assert.equal("closed" in filtersSchema.parse({ closed: "show" }), false, "the old closed=show switch is gone");
assert.equal("sort" in filtersSchema.parse({ sort: "contact" }), false, "no contact sort (ADR 0059)");
// No stage: open Leads, but a search looks at every stage (ADR 0008); a picked tab always wins.
assert.equal(stageTab(base), "open");
assert.equal(stageTab({ ...base, q: "สม" }), "all");
assert.equal(stageTab({ ...base, q: "สม", stage: "closed" }), "closed");

assert.equal(filtersSchema.safeParse({ owner: "all" }).success, true);
assert.equal(filtersSchema.safeParse({ owner: "91000000-0000-4000-a000-000000000001" }).success, true);
assert.equal(filtersSchema.safeParse({ owner: "someone" }).success, false);
assert.equal(filtersSchema.safeParse({ from: "2026-10-02", to: "2026-10-01" }).success, false);

// Repeated keys are a list; one key is wrapped into a list.
assert.deepEqual(plain(filtersSchema.parse({ budget: "1-2 ล้านบาท" }).budget), ["1-2 ล้านบาท"]);
assert.deepEqual(plain(filtersSchema.parse({ channel: ["A", "B"] }).channel), ["A", "B"]);
assert.equal(listHref({ ...base, channel: ["A", "B"] }), "/leads?channel=A&channel=B");

// Survey filters only exist with a brand, and only for values that brand's survey offers.
assert.equal(surveyFilterOptions(undefined), null);
assert.deepEqual(plain(activeSurveyFilters({ budget: ["1-2 ล้านบาท"], channel: ["TikTok"] })), { budget: [], channel: [] });
const bkp = activeSurveyFilters({ brand: "BAAN_KUNAPAP", budget: ["1-2 ล้านบาท", "ต่ำกว่า 10,000"], channel: ["Line / Facebook", "nope"] });
assert.deepEqual(plain(bkp), { budget: ["1-2 ล้านบาท"], channel: ["Line / Facebook"] });
assert.deepEqual(plain(activeSurveyFilters({ brand: "TARAVILLE", budget: ["1-2 ล้านบาท", "30,000 ขึ้นไป"] }).budget), ["30,000 ขึ้นไป"]);
assert.equal(surveyFilterOptions("TARAVILLE")?.budgetChip, "ค่างวด");
assert.equal(surveyFilterOptions("BAAN_KUNAPAP")?.budgetChip, "งบ");

// Instalment buckets are regexes over the stored digit string.
const bucketOf = (label: string, value: string) => instalmentClause([label]).split(",").some(clause => new RegExp(clause.replace("survey->>monthly_installment.match.", "")).test(value));
const labels = [...surveyFilterOptions("TARAVILLE")!.budget];
for (const [value, label] of [["500", labels[0]], ["9999", labels[0]], ["15000.50", labels[1]], ["19999", labels[1]], ["20000", labels[2]], ["29999", labels[2]], ["30000", labels[3]], ["120000", labels[3]]]) {
  assert.deepEqual(plain(labels.filter(item => bucketOf(item, value))), [label], `instalment ${value}`);
}
assert.equal(bucketOf(labels[0], "abc"), false);
assert.equal(instalmentClause(["x"]), "");
assert.equal(instalmentClause(labels).includes("monthly_installment.match."), true);

// "week" is today and the six days before; "month" starts on the 1st; custom dates pass through (Asia/Bangkok).
const today = new Date("2026-11-20T05:00:00Z");
assert.deepEqual(plain(registrationRange({ range: "week" }, today)), { from: "2026-11-14" });
assert.deepEqual(plain(registrationRange({ range: "month", to: "2026-01-01" }, today)), { from: "2026-11-01" });
assert.deepEqual(plain(registrationRange({ range: "custom", from: "2026-10-01", to: "2026-10-31" }, today)), { from: "2026-10-01", to: "2026-10-31" });
assert.deepEqual(plain(registrationRange({}, today)), {});
assert.equal(panelFilterCount(base), 0);
assert.equal(panelFilterCount({ ...base, range: "week", brand: "BAAN_KUNAPAP", budget: ["1-2 ล้านบาท"], channel: ["เพื่อนและครอบครัว", "Line / Facebook"] }), 4);
assert.equal(panelFilterCount({ ...base, range: "custom" }), 0, "custom without dates filters nothing");

// 2026-10-23 12:00 Bangkok; 17:30Z on the 22nd is already the 23rd in Bangkok.
const now = new Date("2026-10-23T05:00:00Z");
assert.equal(relativeDays(null, now), "ยังไม่มี");
assert.equal(relativeDays("2026-10-22T17:30:00Z", now), "วันนี้");
assert.equal(relativeDays("2026-10-22T05:00:00Z", now), "เมื่อวาน");
assert.equal(relativeDays("2026-10-16T05:00:00Z", now), "7 วันก่อน");
assert.equal(relativeDays("2026-08-20T05:00:00Z", now), "2 เดือนก่อน");
assert.equal(relativeDays("2025-01-01T05:00:00Z", now), "1 ปีก่อน");

assert.equal(budgetOf({ brand: "BAAN_KUNAPAP", survey: {} }), "—");
assert.equal(budgetOf({ brand: "BAAN_KUNAPAP", survey: { budget_range: ["x"] } }), "—");
assert.equal(budgetOf({ brand: "BAAN_KUNAPAP", survey: { budget_range: "2-3 ล้านบาท" } }), "2-3 ล้านบาท");
assert.equal(budgetOf({ brand: "TARAVILLE", survey: { monthly_installment: "15000" } }), "ผ่อน 15,000/เดือน");
assert.equal(budgetOf({ brand: "TARAVILLE", survey: { budget_range: "1-2 ล้าน" } }), "—", "Taraville shows the instalment, not the house price");

assert.deepEqual([...pageWindow(1, 1)], [1]);
assert.deepEqual([...pageWindow(1, 5)], [1, 2, 3, 4, 5]);
assert.deepEqual([...pageWindow(10, 20)], [1, null, 8, 9, 10, 11, 12, null, 20]);
console.log("PASS: lead list helpers");
