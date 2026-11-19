import type { SalesCase } from "./models";
import type { TaskName } from "./tasks";

export type CaseTab = "overview" | "design" | "quotation" | "contract" | "documents" | "money";
export type NextStepInput = {
  brand: SalesCase["brand"]; status: SalesCase["status"]; can: Record<string, boolean>;
  hasNetPrice: boolean; hasSummary: boolean; hasBookingReceipt: boolean; isBookingDue: boolean; hasDesignPlan: boolean;
  pendingPayments: number; refundsToAct: number; plotHeld: boolean; isSettled: boolean;
  quotations: { offered: number; accepted: number; offeredId?: string }; contract: "none" | "draft" | "awaiting" | "signed"; contractId?: string;
  instalment: { id?: string; label: string; needsAcceptance: boolean; accepted: boolean; hasInvoice: boolean; outstanding: boolean; isCreditCovered: boolean } | null;
};
export type NextStep = { title: string; hint?: string; tab: CaseTab; anchor?: string; allowed: boolean; kind?: "reserve" | "done"; task?: TaskName; row?: string };

const refundKeys = ["refund.request", "refund.approve", "refund.pay"];

export type ProjectProgress = { steps: string[]; current: number; complete: boolean };
export function projectProgress(input: NextStepInput): ProjectProgress | null {
  if (input.status === "cancelled") return null;
  const complete = input.status === "completed" || (input.status === "contracted" && input.isSettled);
  const steps = input.brand === "BAAN_KUNAPAP"
    ? ["เปิดโครงการ", "กำหนดค่าออกแบบ", "ใบเสนอราคา", "สัญญา", "รับชำระ"]
    : ["เปิดโครงการ", "จองแปลง", "สรุปการจอง", "สัญญา", "รับชำระ"];
  let current = 4;
  if (!complete && input.status !== "contracted") {
    if (input.brand === "TARAVILLE") current = input.status === "draft" ? 1 : input.hasSummary ? 3 : 2;
    else if (input.contract !== "none" || input.quotations.accepted > 0) current = 3;
    else current = input.hasDesignPlan ? 2 : 1;
  }
  if (complete) steps[4] = "ชำระครบ";
  return { steps, current, complete };
}

export function nextStep(input: NextStepInput): NextStep | null {
  const { can } = input;
  const step = (title: string, tab: CaseTab, needs: boolean, extra: Partial<NextStep> = {}): NextStep => ({ title, tab, allowed: needs, ...extra });
  if (input.pendingPayments > 0) {
    return step(`ยืนยันเงินเข้า ${input.pendingPayments} รายการ`, "money", can["financial.confirm"] && can["receipt.issue"], { anchor: "pending" });
  }
  if (input.refundsToAct > 0) {
    return step(`มีคำขอคืนเงิน ${input.refundsToAct} รายการที่ต้องดำเนินการ`, "money", refundKeys.some(key => can[key]), { anchor: "refunds" });
  }
  if (input.status === "cancelled") {
    return input.plotHeld ? step("ปล่อยแปลงหลังปิดงาน", "overview", can["contract.cancel"], { anchor: "release", task: "release" }) : null;
  }
  if (input.status === "completed" || (input.status === "contracted" && input.isSettled)) {
    return { title: "ชำระครบทุกงวดแล้ว", tab: "money", allowed: true, kind: "done" };
  }
  if (input.status === "contracted") {
    const row = input.instalment;
    if (!row) return null;
    if (row.needsAcceptance && !row.accepted) return step(`ตรวจรับงาน ${row.label}`, "money", can["acceptance.record"], { anchor: "schedule", task: "acceptance", row: row.id });
    if (!row.hasInvoice) return step(`${row.isCreditCovered ? "บันทึกงวดที่ชำระครบด้วยเครดิตเดิม" : "ออกใบแจ้งชำระ"} ${row.label}`, "money", can["billing.issue"], { anchor: "schedule", task: "issue-invoice", row: row.id });
    return row.outstanding ? step(`รับชำระ ${row.label}`, "money", can["financial.prepare"], { anchor: "schedule", task: "prepare-instalment", row: row.id }) : null;
  }
  const prepare = can["financial.prepare"];
  if (input.brand === "TARAVILLE") {
    if (input.status === "draft") {
      return input.hasNetPrice ? step("ยืนยันจองแปลง", "overview", prepare, { kind: "reserve", task: "reserve", hint: "ร่างยังไม่กันแปลง ยืนยันแล้วแปลงจะไม่ถูกขายซ้ำ" })
        : step("กรอกข้อมูลการขายและราคา", "overview", prepare, { anchor: "edit", task: "edit-case" });
    }
    if (!input.hasSummary) return step("บันทึกสรุปการจอง", "documents", prepare, { anchor: "summary", task: "booking-summary" });
    if (input.isBookingDue && !input.hasBookingReceipt) return step("รับเงินจอง", "money", prepare, { anchor: "prepare", task: "prepare-payment" });
    return step("บันทึกสัญญาขายที่ลงนามแล้ว", "documents", can["contract.sign"], { anchor: "summary", task: "sign-property-contract" });
  }
  if (input.contract === "draft") return step("ตรวจร่างและล็อกสัญญาเพื่อเซ็น", "documents", prepare, { anchor: "contract", task: "lock-contract", row: input.contractId });
  if (input.contract === "awaiting") return step("บันทึกลงนามสัญญา", "documents", can["contract.sign"], { anchor: "contract", task: "sign-contract", row: input.contractId });
  if (input.quotations.accepted > 0) return step("เตรียมสัญญาจากใบเสนอราคาที่ลูกค้ายอมรับ", "documents", prepare, { anchor: "contract", task: "prepare-contract" });
  if (input.quotations.offered > 0) return step("บันทึกลูกค้ายอมรับใบเสนอราคา", "documents", prepare, { anchor: "contract", task: "accept-quotation", row: input.quotations.offeredId });
  if (!input.hasDesignPlan) return step("กำหนดค่าออกแบบ", "documents", prepare, { anchor: "design", task: "design" });
  return step("จัดทำใบเสนอราคา", "documents", prepare, { anchor: "contract", task: "issue-quotation" });
}

export type MoneySummaryInput = {
  net: string | null;
  payments: { amount_cents: string; totals: Record<string, string> }[];
  instalments: { is_active: boolean; net_cents: string; balance: { outstanding_cents: string } | null }[];
  closeout?: { remaining_cents: string } | null;
};

export function moneySummary({ net, payments, instalments, closeout }: MoneySummaryInput) {
  const zero = BigInt(0);
  const gross = payments.reduce((sum, payment) => sum + BigInt(payment.amount_cents), zero);
  const refunded = payments.reduce((sum, payment) => sum + BigInt(payment.totals.refunded_cents ?? "0"), zero);
  const received = gross > refunded ? gross - refunded : zero;
  const active = instalments.filter(row => row.is_active);
  let outstanding: bigint | null = null;
  if (closeout) outstanding = BigInt(closeout.remaining_cents);
  else if (active.length) outstanding = active.reduce((sum, row) => sum + BigInt(row.balance?.outstanding_cents ?? row.net_cents), zero);
  else if (net !== null) outstanding = BigInt(net) > received ? BigInt(net) - received : zero;
  return { net, received: received.toString(), outstanding: outstanding?.toString() ?? null };
}
