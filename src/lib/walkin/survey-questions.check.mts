import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function catalog(source: string) {
  const exports = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(compiled, { exports }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(exports)).SURVEY_QUESTIONS;
}

const demoPath = new URL("../../../../Taraville/src/components/walkin/WalkinSurveyForm.tsx", import.meta.url);
const demo = readFileSync(demoPath, "utf8");
const questionsOnly = demo.slice(demo.indexOf("type SurveyQuestion"), demo.indexOf("// budget_range"));
const current = readFileSync(new URL("./survey-questions.ts", import.meta.url), "utf8");

// ponytail: BK budget_range diverges from the demo on purpose (owner request, demo left unchanged); every other question must still match.
type Catalog = Record<string, { key: string; options?: string[] }[]>;
const withoutBkBudget = (all: Catalog) => ({ ...all, BAAN_KUNAPAP: all.BAAN_KUNAPAP.map(q => q.key === "budget_range" ? { ...q, options: [] } : q) });
const mine: Catalog = catalog(current);
assert.deepEqual(withoutBkBudget(mine), withoutBkBudget(catalog(questionsOnly)),
  "Both brands must preserve demo question keys, labels, kinds, options and order (except the BK budget options)");
assert.deepEqual(mine.BAAN_KUNAPAP.find(q => q.key === "budget_range")?.options,
  ["ต่ำกว่า 500,000 บาท", "500,000-1,000,000 บาท", "1-2 ล้านบาท", "2-3 ล้านบาท", "3-4 ล้านบาท", "4 ล้านบาทขึ้นไป"]);
console.log("PASS: question catalogs match the demo, except the BK budget ranges");
