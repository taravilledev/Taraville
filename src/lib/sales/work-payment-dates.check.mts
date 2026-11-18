import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relative: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, FormData, Intl, Date, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const paper = load("./contract-paper.ts") as typeof import("./contract-paper");
const old = paper.contractPaperSchema.parse(paper.emptyContractPaper);
assert.equal(old.payment_due_days, undefined, "Parsing an old snapshot never silently opts it into the rule");
assert.equal(paper.contractPaperSchema.parse({ ...old, payment_due_days: 30 }).payment_due_days, 30);
for (const value of [0, 15, 31, "30", null]) assert.equal(paper.contractPaperSchema.safeParse({ ...old, payment_due_days: value }).success, false);
assert.ok(paper.contractPaperMissing({ ...old, extra_clauses: ["Synthetic clause — รอตรวจต้นฉบับ"] }).includes("ข้อสัญญาเพิ่มเติมที่รอตรวจต้นฉบับ"));
assert.ok(!paper.contractPaperMissing({ ...old, extra_clauses: ["Synthetic clause — รอตรวจต้นฉบับ"] }, true).includes("ข้อสัญญาเพิ่มเติมที่รอตรวจต้นฉบับ"));
const calls: { name: string; input: Record<string, unknown> }[] = [];
const { recordAcceptance } = load("../../app/sales/agreement-actions.ts", {
  "@/lib/sales/contract-paper": paper, "@/lib/sales/agreement-inputs": {},
  "@/lib/supabase/staff": { requireStaff: async () => ({}) },
  "@/lib/sales/mutations": { salesMutation: async (_session: unknown, name: string, input: Record<string, unknown>) => { calls.push({ name, input }); return { error: "" }; } },
}) as typeof import("../../app/sales/agreement-actions");
const identity = { id: "00000000-0000-4000-a000-000000000001", version: 1, requestId: "00000000-0000-4000-a000-000000000002" };
function form(date?: string) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ proof_path: "synthetic/acceptance/test.pdf", note: "Checked", inspected: "on", customer_accepted: "on" })) result.set(key, value);
  if (date !== undefined) result.set("acceptance_date", date);
  return result;
}
for (const value of ["2026-02-30", "9999-12-31", "not-a-date"]) {
  const result = await recordAcceptance(identity, { error: "" }, form(value));
  assert.equal(result.field, "acceptance_date");
}
assert.equal(calls.length, 0, "Invalid or future dates never reach the RPC");
await recordAcceptance(identity, { error: "" }, form());
assert.equal(calls.at(-1)?.name, "sales_record_acceptance");
assert.equal(calls.at(-1)?.input.p_acceptance_date, undefined, "Legacy calls retain their original API signature");
await recordAcceptance(identity, { error: "" }, form("2024-02-29"));
assert.equal(calls.at(-1)?.name, "sales_record_acceptance_dated");
assert.equal(calls.at(-1)?.input.p_acceptance_date, "2024-02-29");
const unconfirmed = form("2024-02-29"); unconfirmed.delete("customer_accepted");
await recordAcceptance(identity, { error: "" }, unconfirmed);
assert.equal(calls.length, 2, "Existing evidence and confirmation checks remain required");
console.log("PASS: optional30day snapshot, pending-source real lock warning, actual-date validation and legacy/dated API routing");
