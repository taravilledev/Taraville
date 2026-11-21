import assert from "node:assert/strict";
// @ts-expect-error node runs this file directly and needs the .ts extension
import { projectProgress, type NextStepInput } from "./case-progress.ts";
// @ts-expect-error node runs this file directly and needs the .ts extension
import { bkpOverviewStage, bkpOverviewStages, bkpWorkflow } from "./bkp-workflow.ts";

type Finance = Parameters<typeof bkpWorkflow>[0];
type Doc = Parameters<typeof bkpWorkflow>[1]["documents"][number];

const names = ["เปิดโครงการ", "ออกแบบ", "ใบเสนอราคา", "สัญญา", "รับชำระ"];
const base: NextStepInput = { brand: "BAAN_KUNAPAP", status: "draft", can: {}, hasNetPrice: false, hasSummary: false, hasBookingReceipt: false,
  isBookingDue: false, hasDesignPlan: false, pendingPayments: 0, refundsToAct: 0, plotHeld: false, isSettled: false,
  quotations: { offered: 0, accepted: 0 }, contract: "none", instalment: null };

assert.deepEqual(projectProgress(base)?.steps, names);
assert.deepEqual(Object.values(bkpOverviewStages), names);
assert.equal(projectProgress({ ...base, status: "contracted", isSettled: true })?.steps[4], "ชำระครบ");

const plan = { tier: "under150", usable_area: "120", total_cents: "1200000", instalments: ["350000", "350000", "500000"], note: "" };
const finance = (design_plan: Finance["design_plan"], paid = "0"): Finance => ({
  case_id: "case", version: 1, issuer_ready: true, can_change_design: true, pending: [], documents: [], design_bills: [],
  design_legacy_received_cents: "0", design_legacy_has_payments: false, design_plan,
  payments: paid === "0" ? [] : [{ kind: "design_fee", amount_cents: paid, totals: {} }] as unknown as Finance["payments"],
});
const doc = (kind: string, state: string, payload: Doc["payload"] = {}): Doc =>
  ({ id: kind + state, number: null, revision: 1, version: 1, evidence_path: null, kind, state, payload }) as Doc;
const quote = (state: string) => doc("quotation", state, { total_cents: "1000000" });

const facts = (patch: Partial<NonNullable<NextStepInput["design"]>> = {}): NextStepInput["design"] =>
  ({ canCollect: true, feesPaid: false, hasQuotation: false, instalments: [], ...patch });
const fixtures: { name: string; finance: Finance; documents: Doc[]; isSettled?: boolean; input: Partial<NextStepInput> }[] = [
  { name: "no design plan", finance: finance(null), documents: [], input: {} },
  { name: "design plan only", finance: finance(plan), documents: [], input: { hasDesignPlan: true, design: facts() } },
  { name: "design fee partly paid", finance: finance(plan, "350000"), documents: [], input: { hasDesignPlan: true, design: facts() } },
  { name: "design fee fully paid", finance: finance(plan, "1200000"), documents: [], input: { hasDesignPlan: true, design: facts({ feesPaid: true }) } },
  { name: "unpriced quotation draft", finance: finance(plan), documents: [doc("quotation", "offered")], input: { hasDesignPlan: true, design: facts({ hasQuotation: true }) } },
  { name: "quotation issued", finance: finance(plan), documents: [quote("offered")], input: { hasDesignPlan: true, quotations: { offered: 1, accepted: 0 } } },
  { name: "quotation accepted", finance: finance(plan), documents: [quote("accepted")], input: { hasDesignPlan: true, quotations: { offered: 0, accepted: 1 } } },
  { name: "contract draft", finance: finance(plan), documents: [quote("accepted"), doc("contract", "draft")],
    input: { hasDesignPlan: true, quotations: { offered: 0, accepted: 1 }, contract: "draft" } },
  { name: "contract signed", finance: finance(plan), documents: [quote("accepted"), doc("contract", "signed")],
    input: { status: "contracted", hasDesignPlan: true, quotations: { offered: 0, accepted: 1 }, contract: "signed" } },
  { name: "fully paid", finance: finance(plan, "1200000"), documents: [quote("accepted"), doc("contract", "signed")], isSettled: true,
    input: { status: "completed", hasDesignPlan: true, quotations: { offered: 0, accepted: 1 }, contract: "signed", isSettled: true } },
];

const overviewIndex = { intake: 0, design: 1, quotation: 2, contract: 3, money: 4 };
const rows = fixtures.map(item => {
  const flow = bkpWorkflow(item.finance, { documents: item.documents, is_settled: item.isSettled ?? false, instalments: [] });
  const overview = overviewIndex[bkpOverviewStage(flow)];
  const progress = projectProgress({ ...base, ...item.input })?.current;
  return { name: item.name, overview, progress };
});
console.table(rows);
const disagreements = rows.filter(row => row.overview !== row.progress).map(row => row.name);

// ADR 0057: one BKP stage. projectProgress (lists, stage track) must land where bkpOverviewStage (workspace, /summary) does.
assert.deepEqual(disagreements, []);
