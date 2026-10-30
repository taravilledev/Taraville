import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const migrations = new URL("../migrations/", import.meta.url);
const files = readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort();
assert.equal(files.length, 16, "Review this check when the pilot migration set changes");
const sources = files.map((name) => {
  const source = readFileSync(new URL(name, migrations), "utf8");
  assert.ok(source.trimEnd().split("\n").length <= 300, `${name} exceeds 300 lines`);
  return source;
});
const sql = sources.join("\n").replace(/--[^\n]*/g, "");
const normalized = sql.replace(/\s+/g, " ").toLowerCase();
const live = readFileSync(new URL("20261022102243_walkin_live_intake.sql", migrations), "utf8");
assert.match(live, /revoke all on function public\.walkin_create_lead\(uuid, text, jsonb, jsonb, uuid\) from public, anon, authenticated;/);
assert.match(live, /revoke all on function private\.walkin_remove_lead\(uuid, bigint, text\) from public, anon, authenticated;/);
assert.match(live, /current_user = 'postgres' and tg_op = 'DELETE'/);
const source = readFileSync(new URL("../../src/lib/walkin/survey-questions.ts", import.meta.url), "utf8");
const exports = {};
runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports }, { timeout: 1000 });
type Question = { key: string; kind: string; options?: string[] };
const catalogs: Record<string, Question[]> = JSON.parse(JSON.stringify(exports)).SURVEY_QUESTIONS;
const expected = Object.fromEntries(Object.entries(catalogs).map(([brand, questions]) => [brand,
  questions.map(({ key, kind, options }) => options ? { key, kind, options } : { key, kind }),
]));
const frozen = [...sql.matchAll(/\$catalog\$([\s\S]*?)\$catalog\$/g)];
assert.equal(frozen.length, 2, "Review the catalog replacements when migrations change");
assert.deepEqual(JSON.parse(frozen.at(-1)![1]), expected, "The latest SQL catalog must match both TS catalogs");

for (const table of ["staff", "leads"]) {
  assert.ok(normalized.includes(`alter table public.${table} enable row level security;`), `${table} needs RLS`);
}
assert.match(normalized, /revoke all on public\.staff, public\.leads from public, anon, authenticated;/);
const grants = normalized.match(/grant [^;]+;/g) ?? [];
for (const grant of grants) {
  if (/on (?:table )?public\.(?:staff|leads)\b/.test(grant)) {
    assert.equal(grant, "grant select on public.staff, public.leads to authenticated;", "Only authenticated SELECT is allowed");
  }
  if (grant.includes("on function")) {
    assert.match(grant, / to authenticated;$/, "Functions must not grant anon/PUBLIC execution");
  }
}
assert.match(normalized, /revoke all on schema private from public, anon;/);
assert.ok(!grants.some((grant) => /on schema private/.test(grant) && grant !== "grant usage on schema private to authenticated;"));
for (const name of ["create", "update", "reassign"]) {
  for (const schema of ["public", "private"]) {
    const functionName = `${schema}.walkin_${name}_lead`;
    const escaped = functionName.replaceAll(".", "\\.");
    const header = normalized.match(new RegExp(`create function ${escaped}\\([^]*?as \\$\\$`))?.[0];
    assert.ok(header, `${functionName} must exist`);
    assert.ok(header.includes(`security ${schema === "public" ? "invoker" : "definer"}`), `${functionName} security mode`);
    assert.ok(header.includes("set search_path = ''"), `${functionName} must pin its search path`);
    assert.match(normalized, new RegExp(`revoke all on function ${escaped}\\([^;]*?from public, anon, authenticated;`));
    assert.ok(grants.some((grant) => grant.includes(`${functionName}(`)), `${functionName} needs authenticated execution`);
  }
}
for (const name of ["walkin_survey_catalog", "walkin_validate_input", "walkin_lock_actor"]) {
  assert.match(normalized, new RegExp(`revoke all on function private\\.${name}\\([^;]*?from public, anon, authenticated;`));
  assert.ok(!grants.some((grant) => grant.includes(`private.${name}(`)), `${name} must remain internal`);
}
console.log("PASS: frozen catalog, migration size, RLS and declared privilege boundaries");
console.log("Static source checks do not prove SQL execution, effective database privileges or runtime security.");
