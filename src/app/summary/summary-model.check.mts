import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path: string, imports: Record<string, unknown> = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, URL, URLSearchParams, Response, require: (name: string) => imports[name] ?? require(name) });
  return exports;
}
const model = load("./summary-model.ts", {
  "../../lib/sales/money": load("../../lib/sales/money.ts"),
  "../../lib/sales/bkp-workflow": load("../../lib/sales/bkp-workflow.ts"),
  "../../lib/walkin/lead-csv": load("../../lib/walkin/lead-csv.ts", {
    "./lead-stage": load("../../lib/walkin/lead-stage.ts"),
    "./survey-questions": load("../../lib/walkin/survey-questions.ts"),
  }),
}) as typeof import("./summary-model");
const { collectionTotals, displayAmount, isOverdue, periodSchema, summaryEntries, summaryQuery,
  summaryPageRange, summaryReport, selectSummaryReport, summaryCsv, amountState,
  filterSummaryReportRows, updateSummarySelection } = model;

const today = "2026-11-17";
const older = { outstanding: "101", billed: true, due: "2026-11-16", reference: false };
const todayBill = { ...older, outstanding: "29", due: today };
const unbilled = { ...older, outstanding: "70", billed: false };
const closed = { ...older, outstanding: "1000", reference: true };
const paid = { ...older, outstanding: "0" };
const unknown = { ...older, outstanding: null };

assert.deepEqual({ ...collectionTotals([older, todayBill, unbilled, closed, paid, unknown], today) }, {
  billed: BigInt(130), unbilled: BigInt(70), overdue: BigInt(101),
});
assert.equal(isOverdue(older, today), true);
for (const record of [todayBill, unbilled, closed, paid, unknown]) assert.equal(isOverdue(record, today), false);

assert.equal(displayAmount("-1"), "−0.01");
assert.equal(displayAmount("100000000000000000001"), "1,000,000,000,000,000,000.01");
assert.equal(displayAmount(null), "—");

assert.equal(periodSchema.safeParse({ from: "2024-02-29" }).success, true);
assert.equal(periodSchema.safeParse({ from: today, to: today }).success, true);
assert.equal(periodSchema.safeParse({ from: today, to: "2026-11-16" }).success, false);
assert.equal(periodSchema.safeParse({ from: "2026-02-29" }).success, false);
assert.equal(periodSchema.safeParse({ from: "0000-01-01" }).success, false);

const base = { stage: "money", customer: "ณิชา อยู่สบาย", pending: "0", closeout: "0" };
const projects = [
  { ...base, code: "BKP-141", rows: [unbilled] },
  { ...base, code: "BKP-142", pending: "100", rows: [] },
  { ...base, code: "BKP-143", stage: "design", rows: [older] },
  { ...base, code: "BKP-144", stage: "cancelled", closeout: "100", rows: [closed] },
];
const filters = { query: "", stage: "", money: "" };
const codes = (patch: Partial<typeof filters> = {}) =>
  Array.from(summaryEntries(projects, today, { ...filters, ...patch }).visible, entry => entry.project.code);
assert.deepEqual(codes(), ["BKP-143", "BKP-142", "BKP-141", "BKP-144"]);
assert.deepEqual(codes({ query: " bkp-142 ", stage: "money", money: "pending" }), ["BKP-142"]);
assert.deepEqual(codes({ query: "ณิชา", stage: "design", money: "overdue" }), ["BKP-143"]);
assert.deepEqual(codes({ stage: "money", money: "overdue" }), []);
assert.deepEqual(codes({ money: "unbilled" }), ["BKP-141"]);
assert.deepEqual(codes({ money: "closeout" }), ["BKP-144"]);

const { bkpOverviewStage, bkpWorkflow } = load("../../lib/sales/bkp-workflow.ts") as typeof import("../../lib/sales/bkp-workflow");
const finance: Parameters<typeof bkpWorkflow>[0] = {
  case_id: "case", version: 1, issuer_ready: true, can_change_design: true, payments: [], pending: [], documents: [],
  design_bills: [], design_legacy_received_cents: "0", design_legacy_has_payments: false,
  design_plan: { tier: "under150", usable_area: "120", total_cents: "1200000", instalments: ["350000", "350000", "500000"], note: "" },
};
const quote = { id: "quote", number: null, revision: 1, version: 1, evidence_path: null,
  kind: "quotation", state: "offered", payload: { price_set: false } };
const stage = (...documents: Parameters<typeof bkpWorkflow>[1]["documents"]) =>
  bkpOverviewStage(bkpWorkflow(finance, { documents, is_settled: false, instalments: [] }));
assert.equal(stage(), "design");
assert.equal(stage(quote), "quotation");
assert.equal(stage({ ...quote, state: "accepted", payload: { total_cents: "1000000" } }), "contract");
assert.equal(stage(quote, { ...quote, id: "contract", kind: "contract", state: "signed", payload: {} }), "money");

const reportProjects: Parameters<typeof summaryReport>[0] = Array.from({ length: 31 }, (_, i) => ({
  ...base, stage: i === 30 ? "contract" : "money",
  id: String(i), code: `BKP-${i + 100}`, customer: i === 0 ? "  =42" : "ชื่อสมมติ", owner: "ผู้ดูแล",
  status: "contracted", value: i === 0 ? null : "1000", received: "-1", receivedTotal: "100", rows: [],
}));
const query = summaryQuery({ stage: "money", page: "2", from: today });
const report = summaryReport(reportProjects, today, query);
const mainQuery = summaryQuery({ stage: "money" });
assert.equal(mainQuery.isPeriodView, false);
assert.equal(summaryReport(reportProjects, today, mainQuery).columns.some(col => col.key === "period"), false);
assert.equal(summaryQuery({ view: "period" }).isPeriodView, true);
assert.equal(query.isPeriodView, true, "Existing dated URLs must open the period view");
assert.equal(query.params.get("view"), "period", "Print and pagination links retain the view");
assert.equal(summaryQuery({ from: "invalid" }).isPeriodView, true);
assert.equal(summaryQuery({ from: "invalid" }).isPeriodValid, false);
const sortedProjectFixtures = [
  { ...reportProjects[0], code: "BKP-2", value: null, receivedTotal: "-100" },
  { ...reportProjects[1], code: "BKP-10", value: "900719925474099300", receivedTotal: "0" },
  { ...reportProjects[2], code: "BKP-3", value: "900719925474099301", receivedTotal: "100" },
];
const sorted = (sort: string) => summaryReport(sortedProjectFixtures, today, summaryQuery({ sort }));
assert.deepEqual(Array.from(sorted("code.asc").rows, row => row.code), ["BKP-2", "BKP-3", "BKP-10"]);
assert.deepEqual(Array.from(sorted("value.asc").rows, row => row.code), ["BKP-10", "BKP-3", "BKP-2"]);
assert.deepEqual(Array.from(sorted("value.desc").rows, row => row.code), ["BKP-3", "BKP-10", "BKP-2"]);
assert.equal(summaryQuery({ sort: "period.desc" }).sort, null);
assert.equal(summaryQuery({ sort: "value.asc." }).sort, null);
assert.equal(amountState("received", BigInt(1)), "received");
assert.equal(amountState("received", BigInt(-1)), "overdue");
assert.equal(amountState("overdue", BigInt(0)), "quiet");
assert.equal(amountState("pending", BigInt(1)), "pending");
const page = summaryPageRange(report.rows.length, query.page);
assert.deepEqual({ ...page }, { page: 2, totalPages: 2, start: 25, end: 30 });
assert.equal(report.rows.slice(page.start, page.end)[0]?.code, "BKP-125");
assert.equal(summaryPageRange(30, summaryQuery({ page: "9999999999999999999" }).page).page, 2);
assert.equal(report.columns.find(col => col.key === "value")?.total, BigInt(29000));
assert.equal(report.columns.find(col => col.key === "received")?.total, BigInt(3000));
assert.equal(report.columns.find(col => col.key === "period")?.total, BigInt(-30));
const csv = summaryCsv(report);
assert.equal(csv.charCodeAt(0), 0xfeff);
assert.equal(csv.split("\r\n").filter(line => /^BKP-/.test(line)).length, 30);
assert.match(csv, /BKP-100,'  =42,ผู้ดูแล,การเงิน,,1\.00,-0\.01,/);
assert.match(csv, /รวม,,,,290\.00,30\.00,-0\.30,/);
assert.doesNotMatch(csv, /BKP-130/);

const pickerReport = summaryReport([
  { ...reportProjects[0], pending: "500" },
  { ...reportProjects[1], pending: "700" },
  reportProjects[30],
], today, summaryQuery({}));
const pickerRows = (query: string, stage = "", money = "") =>
  Array.from(filterSummaryReportRows(pickerReport.rows, { query, stage, money }), row => row.id);
assert.deepEqual(pickerRows(" BKP-100 ", "money", "pending"), ["0"]);
assert.deepEqual(pickerRows("ชื่อสมมติ", "money", "pending"), ["1"]);
assert.deepEqual(pickerRows("", "contract", "pending"), []);
const firstSelection = updateSummarySelection(new Set(["30"]), pickerRows("", "money", "pending"), true);
assert.deepEqual(Array.from(firstSelection), ["30", "0", "1"]);
assert.deepEqual(Array.from(updateSummarySelection(firstSelection, pickerRows("BKP-100"), false)), ["30", "1"]);

const selectedReport = selectSummaryReport(report, new Set(["25", "0", "outside-filter"]));
assert.deepEqual(Array.from(selectedReport.rows, row => row.code), ["BKP-100", "BKP-125"]);
assert.equal(selectedReport.columns.find(column => column.key === "value")?.total, BigInt(1000));
assert.equal(selectedReport.columns.find(column => column.key === "period")?.total, BigInt(-2));
assert.equal(selectSummaryReport(report, new Set()).columns[0]?.total, null);
assert.deepEqual(selectSummaryReport(report, new Set(report.rows.map(row => row.id))), report);
const selectedLines = summaryCsv(selectedReport, true).split("\r\n");
assert.match(selectedLines[1] ?? "", /^รวม,,,,10\.00,2\.00,-0\.02,/);
assert.match(selectedLines[2] ?? "", /^BKP-100,/);
assert.match(selectedLines[3] ?? "", /^BKP-125,/);
assert.equal(selectedLines.length, 5);


let role = "sale";
let reads = 0;
const { GET } = load("./export/route.ts", {
  "../summary-model": model,
  "@/lib/supabase/staff": { requireStaff: async () => ({ staff: { role }, supabase: {} }) },
  "@/lib/sales/executive": { executiveSummary: async () => { reads++; return reportProjects; } },
}) as typeof import("./export/route");
const request = (query: string) => new Request(`http://localhost/summary/export?${query}`);
assert.equal((await GET(request("stage=money"))).status, 403);
role = "executive";
assert.equal((await GET(request(`from=${today}&to=2001-01-01`))).status, 400);
assert.equal(reads, 0);
const exported = await GET(request(`stage=money&page=2&from=${today}`));
assert.equal(exported.status, 200);
assert.equal(exported.headers.get("Cache-Control"), "private, no-store");
assert.match(exported.headers.get("Content-Disposition") ?? "", /^attachment;/);
assert.equal(await exported.text(), csv.slice(1));
