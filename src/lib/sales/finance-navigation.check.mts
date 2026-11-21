import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { SalesCase } from "./models";
import type { ActionState } from "../../app/walkin/action-form";

const require = createRequire(import.meta.url);
function load(path: string, imports: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, FormData, Date, Intl, URL, crypto: { randomUUID }, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const nav = load("./case-navigation.ts") as typeof import("./case-navigation");
assert.equal(nav.resolveCaseTab(nav.bkpCaseTabs, "overview", "fees"), "money");
assert.equal(nav.taskReturnTab("design", true), "design");
for (const name of ["issue-design-invoice", "prepare-design-payment", "cancel-design-invoice"] as const) {
  assert.equal(nav.taskReturnTab(name, true), "design", "ADR 0058: design-fee billing returns to the ออกแบบ stage");
  assert.equal(nav.taskReturnTab(name, false), "design");
}
assert.equal(nav.taskReturnTab("confirm-payment", true, true), "money");
assert.equal(nav.taskReturnTab("withdraw-payment", true, true), "money");
assert.equal(nav.taskReturnTab("acceptance", false), "overview");

const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const sale: SalesCase = { id: id(1), version: 1, code: "BKP-TEST", brand: "BAAN_KUNAPAP", status: "draft",
  lead_id: id(2), responsible_id: id(3), customer_name: "Synthetic", can_finance: true, project_id: null, unit_id: null, customer_id: id(4),
  responsible_name: "Synthetic", lead_owner_name: "Synthetic", can_edit: true, can_assign: false, permissions: {} };
const { idOf } = load("../../app/sales/[id]/tasks/task-data.ts") as typeof import("../../app/sales/[id]/tasks/task-data");
const bkp = idOf(sale);
const legacy = idOf({ ...sale, brand: "TARAVILLE" });
assert.equal(bkp.returnTab, "money");
assert.equal(legacy.returnTab, undefined);
assert.equal(idOf({ ...sale, can_finance: false }).returnTab, undefined, "Operational-only BKP readers retain their original destination");

class Navigation extends Error {
  readonly href: string;
  constructor(href: string) { super(href); this.href = href; }
}
const calls: { name: string; input: Record<string, unknown> }[] = [];
let response: { data: unknown; error: { code: string; message: string } | null } = { data: { id: sale.id }, error: null };
let revalidated = 0;
const session = { supabase: { rpc: async (name: string, input: Record<string, unknown>) => { calls.push({ name, input }); return response; } } };
const mutations = load("./mutations.ts", {
  "server-only": {}, "next/navigation": { redirect: (href: string) => { throw new Navigation(href); } },
  "next/cache": { revalidatePath: () => { revalidated++; } },
  "@/lib/action-feedback": load("../action-feedback.ts"),
}) as typeof import("./mutations");
const common = { "@/lib/supabase/staff": { requireStaff: async () => session }, "@/lib/sales/mutations": mutations,
  "@/lib/sales/money": load("./money.ts"), "@/lib/sales/design-fees": load("./design-fees.ts"),
  "@/lib/sales/financial-models": {}, "@/lib/sales/agreement-inputs": {}, "@/lib/sales/contract-paper": {} };
const money = load("../../app/sales/money-actions.ts", common) as typeof import("../../app/sales/money-actions");
const design = load("../../app/sales/design-billing-actions.ts", common) as typeof import("../../app/sales/design-billing-actions");
const refunds = load("../../app/sales/refund-actions.ts", common) as typeof import("../../app/sales/refund-actions");
const agreements = load("../../app/sales/agreement-actions.ts", common) as typeof import("../../app/sales/agreement-actions");
type Action = (context: unknown, state: ActionState, form: FormData) => Promise<ActionState>;
function feedbackHref(href: string, code: string) {
  const url = new URL(href, "http://example.test");
  url.searchParams.set("feedback", code);
  return url.pathname + url.search + url.hash;
}
const financeHref = `/sales/${sale.id}?tab=money`;
function form(fields: Record<string, string>) {
  const value = new FormData();
  for (const [key, item] of Object.entries(fields)) value.set(key, item);
  return value;
}
async function invoke(action: Action, fields: Record<string, string>, href = financeHref, context: unknown = bkp) {
  const before = calls.length;
  await assert.rejects(action(context, { error: "" }, form(fields)), error => {
    assert.ok(error instanceof Navigation);
    assert.equal(error.href, feedbackHref(href, calls.at(-1)?.name ?? ""));
    return true;
  });
  assert.equal(calls.length, before + 1);
  assert.ok(!JSON.stringify(calls.at(-1)?.input).includes("returnTab"), "Navigation hint never reaches RPC arguments");
}
await invoke(money.saveDesign, { tier: "under150", usable_area: "120" }, `/sales/${sale.id}?tab=design#design-fees`);
await invoke(design.issueDesignInvoice, { position: "1", due_date: "2026-12-01", confirmed: "on" });
await invoke(design.cancelDesignInvoice, { reason: "Synthetic cancel", confirmed: "on" });
const payment = { method: "cash", paid_date: "2026-11-01", payer_name: "Synthetic payer", description: "Synthetic receipt", proof_path: "" };
await invoke(design.prepareDesignPayment, payment);
await invoke(money.preparePayment, { ...payment, kind: "unallocated", invoice_id: "", amount: "100.50" });
assert.equal((calls.at(-1)?.input.p_input as Record<string, unknown>).amount_cents, "10050");
await invoke(money.preparePayment, { ...payment, kind: "booking", invoice_id: "", amount: "100.50" }, `/sales/${sale.id}`, legacy);
await invoke(money.confirmPayment, { funds_confirmed: "on" });
await invoke(money.confirmPayment, { funds_confirmed: "on" }, `/sales/${sale.id}`, legacy);
await invoke(money.withdrawPayment, { reason: "Synthetic withdraw", confirmed: "on" });
await invoke(money.correctReceipt, { reason: "Synthetic correction", description: "Corrected", confirmed: "on" });
await invoke(money.correctPayment, { reason: "Synthetic correction", amount: "100.50", proof_path: "test/proof.pdf", confirmed: "on" });
await invoke(refunds.requestRefund, { payment_id: id(5), amount: "1.00", reason: "Synthetic refund" });
await invoke(refunds.decideRefund, { decision: "approved", note: "Synthetic decision" });
await invoke(refunds.payRefund, { method: "transfer", paid_date: "2026-11-01", proof_path: "test/refund.pdf", funds_confirmed: "on" });
await invoke(agreements.recordAcceptance, { note: "Synthetic acceptance", proof_path: "test/acceptance.pdf", inspected: "on", customer_accepted: "on" });
await invoke(agreements.issueInvoice, { due_date: "2026-12-01" });

const moneyTasks = load("../../app/sales/[id]/tasks/money-tasks.tsx", {
  "@/app/walkin/action-form": { ActionForm: () => null }, "../../agreement-actions": agreements, "../../money-actions": money,
  "../../evidence-upload": {}, "./payment-paper": {}, "../acceptance-form": {}, "../../sales.module.css": { default: {} },
  "./task-data": { idOf },
}) as typeof import("../../app/sales/[id]/tasks/money-tasks");
const financialModels = load("./financial-models.ts", { "./models": load("./models.ts") }) as typeof import("./financial-models");
const taskData = { sale, staffId: id(3), row: id(8), agreement: null, reservation: null, refunds: [], owners: [],
  finance: financialModels.financialSchema.parse({ case_id: sale.id, version: 7, issuer_ready: true, can_change_design: false,
    design_plan: null, pending: [], payments: [], documents: [] }) };
const boundWithdraw = moneyTasks.WithdrawPaymentTask(taskData).props.action as (state: ActionState, input: FormData) => Promise<ActionState>;
await assert.rejects(boundWithdraw({ error: "" }, form({ reason: "Synthetic task withdraw", confirmed: "on" })), error => error instanceof Navigation && error.href === feedbackHref(financeHref, "sales_reject_pending_payment"));
assert.equal(calls.at(-1)?.input.p_payment_request_id, taskData.row, "Real task binds the selected payment id");
assert.equal(calls.at(-1)?.input.p_version, 7, "Real task retains the finance version, not the case version");
assert.ok(!JSON.stringify(calls.at(-1)?.input).includes("returnTab"));
const legacyWithdraw = moneyTasks.WithdrawPaymentTask({ ...taskData, sale: { ...sale, brand: "TARAVILLE" } }).props.action as (state: ActionState, input: FormData) => Promise<ActionState>;
await assert.rejects(legacyWithdraw({ error: "" }, form({ reason: "Synthetic legacy withdraw", confirmed: "on" })), error => error instanceof Navigation && error.href === feedbackHref(`/sales/${sale.id}`, "sales_reject_pending_payment"));

const beforeInvalid = calls.length;
assert.ok((await money.saveDesign(bkp, { error: "" }, form({ tier: "under150", usable_area: "" }))).error);
assert.ok((await money.confirmPayment(bkp, { error: "" }, form({}))).error);
assert.ok((await money.confirmPayment({ ...bkp, returnTab: "https://example.invalid" }, { error: "" }, form({ funds_confirmed: "on" }))).error);
assert.equal(calls.length, beforeInvalid, "Invalid navigation/fields/confirmation never invoke mutation");
const actualMutation = mutations.salesMutation as (session: unknown, name: string, input: Record<string, unknown>, destination: "case" | "design" | "finance", nextTask?: "design") => Promise<ActionState>;
await assert.rejects(actualMutation(session, "test", {}, "case", "design"), error => error instanceof Navigation && error.href === feedbackHref(`/sales/${sale.id}?task=design`, "saved"));
response = { data: null, error: { code: "42501", message: "private internal reason" } };
const beforeFailure = revalidated;
const denied = await actualMutation(session, "test", {}, "finance");
assert.ok(denied.error && !denied.error.includes("private internal reason"));
assert.equal(revalidated, beforeFailure, "Rejected RPC never revalidates or navigates");
response = { data: {}, error: null };
for (const destination of ["case", "design", "finance"] as const) assert.ok((await actualMutation(session, "test", {}, destination)).error);
assert.equal(revalidated, beforeFailure, "Missing returned case id never navigates");
console.log("PASS: BKP finance task returns, package/billing redirects, constrained hint, unchanged legacy route and mutation failure guards");
