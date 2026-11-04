import type { SalesCase } from "./models";

export type CaseTab = "overview" | "documents" | "money" | "adjust";
export type NextStepInput = {
  brand: SalesCase["brand"]; status: SalesCase["status"]; can: Record<string, boolean>;
  hasNetPrice: boolean; hasSummary: boolean; hasBookingReceipt: boolean; isBookingDue: boolean; hasDesignPlan: boolean;
  pendingPayments: number; refundsToAct: number; plotHeld: boolean; isSettled: boolean;
  quotations: { offered: number; accepted: number }; contract: "none" | "awaiting" | "signed";
  instalment: { label: string; needsAcceptance: boolean; accepted: boolean; hasInvoice: boolean; outstanding: boolean; isCreditCovered: boolean } | null;
};
export type NextStep = { title: string; hint?: string; tab: CaseTab; anchor?: string; allowed: boolean; kind?: "reserve" | "done" };

const refundKeys = ["refund.request", "refund.approve", "refund.pay"];

export function nextStep(input: NextStepInput): NextStep | null {
  const { can } = input;
  const step = (title: string, tab: CaseTab, needs: boolean, extra: Partial<NextStep> = {}): NextStep => ({ title, tab, allowed: needs, ...extra });
  if (input.pendingPayments > 0) {
    return step(`ยืนยันเงินเข้า ${input.pendingPayments} รายการ`, "money", can["financial.confirm"] && can["receipt.issue"], { anchor: "pending" });
  }
  if (input.refundsToAct > 0) {
    return step(`มีคำขอคืนเงิน ${input.refundsToAct} รายการที่ต้องดำเนินการ`, "adjust", refundKeys.some(key => can[key]), { anchor: "refunds" });
  }
  if (input.status === "cancelled") {
    return input.plotHeld ? step("ปล่อยแปลงหลังปิดงาน", "adjust", can["contract.cancel"], { anchor: "release" }) : null;
  }
  if (input.status === "completed" || (input.status === "contracted" && input.isSettled)) {
    return { title: "ชำระครบทุกงวดแล้ว", tab: "money", allowed: true, kind: "done" };
  }
  if (input.status === "contracted") {
    const row = input.instalment;
    if (!row) return null;
    if (row.needsAcceptance && !row.accepted) return step(`ตรวจรับงาน ${row.label}`, "money", can["acceptance.record"], { anchor: "schedule" });
    if (!row.hasInvoice) return step(`${row.isCreditCovered ? "บันทึกงวดที่ชำระครบด้วยเครดิตเดิม" : "ออกใบแจ้งชำระ"} ${row.label}`, "money", can["billing.issue"], { anchor: "schedule" });
    return row.outstanding ? step(`รับชำระ ${row.label}`, "money", can["financial.prepare"], { anchor: "schedule" }) : null;
  }
  const prepare = can["financial.prepare"];
  if (input.brand === "TARAVILLE") {
    if (input.status === "draft") {
      return input.hasNetPrice ? step("ยืนยันจองแปลง", "overview", prepare, { kind: "reserve", hint: "ร่างยังไม่กันแปลง ยืนยันแล้วแปลงจะไม่ถูกขายซ้ำ" })
        : step("กรอกข้อมูลการขายและราคา", "overview", prepare, { anchor: "edit" });
    }
    if (!input.hasSummary) return step("บันทึกสรุปการจอง", "documents", prepare, { anchor: "summary" });
    if (input.isBookingDue && !input.hasBookingReceipt) return step("รับเงินจอง", "money", prepare, { anchor: "prepare" });
    return step("บันทึกสัญญาขายที่ลงนามแล้ว", "documents", can["contract.sign"], { anchor: "summary" });
  }
  if (input.contract === "awaiting") return step("บันทึกลงนามสัญญา", "documents", can["contract.sign"], { anchor: "contract" });
  if (input.quotations.accepted > 0) return step("เตรียมสัญญาจากใบเสนอราคาที่ลูกค้ายอมรับ", "documents", prepare, { anchor: "contract" });
  if (input.quotations.offered > 0) return step("บันทึกลูกค้ายอมรับใบเสนอราคา", "documents", prepare, { anchor: "contract" });
  if (!input.hasDesignPlan) return step("กำหนดค่าออกแบบ", "documents", prepare, { anchor: "design" });
  if (!input.hasNetPrice) return step("กรอกข้อมูลการขายและราคา", "overview", prepare, { anchor: "edit", hint: "ต้องมีราคาสุทธิก่อนออกใบเสนอราคา" });
  return step("ออกใบเสนอราคา", "documents", prepare, { anchor: "contract" });
}

export type MoneySummaryInput = {
  net: string | null;
  payments: { amount_cents: string; totals: Record<string, string> }[];
  instalments: { is_active: boolean; net_cents: string; balance: { outstanding_cents: string } | null }[];
};

export function moneySummary({ net, payments, instalments }: MoneySummaryInput) {
  const zero = BigInt(0);
  const gross = payments.reduce((sum, payment) => sum + BigInt(payment.amount_cents), zero);
  const refunded = payments.reduce((sum, payment) => sum + BigInt(payment.totals.refunded_cents ?? "0"), zero);
  const received = gross > refunded ? gross - refunded : zero;
  const active = instalments.filter(row => row.is_active);
  let outstanding: bigint | null = null;
  if (active.length) outstanding = active.reduce((sum, row) => sum + BigInt(row.balance?.outstanding_cents ?? row.net_cents), zero);
  else if (net !== null) outstanding = BigInt(net) > received ? BigInt(net) - received : zero;
  return { net, received: received.toString(), outstanding: outstanding?.toString() ?? null };
}
