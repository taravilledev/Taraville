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

assert.deepEqual(catalog(current), catalog(questionsOnly),
  "Both brands must preserve demo question keys, labels, kinds, options and order");
console.log("PASS: both brands' question catalogs match the demo exactly");
