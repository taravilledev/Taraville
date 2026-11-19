import assert from "node:assert/strict";
// @ts-expect-error node runs this file directly and needs the .ts extension
import { moneySummary, nextStep, projectProgress, type NextStepInput } from "./case-progress.ts";

const all = Object.fromEntries(["financial.prepare", "financial.confirm", "receipt.issue", "contract.sign", "contract.cancel", "billing.issue",
  "acceptance.record", "refund.request", "refund.approve", "refund.pay"].map(key => [key, true]));
const base: NextStepInput = { brand: "TARAVILLE", status: "draft", can: all, hasNetPrice: true, hasSummary: false, hasBookingReceipt: false, isBookingDue: true,
  hasDesignPlan: false, pendingPayments: 0, refundsToAct: 0, plotHeld: false, isSettled: false,
  quotations: { offered: 0, accepted: 0 }, contract: "none", instalment: null };
const at = (patch: Partial<NextStepInput>) => nextStep({ ...base, ...patch });

assert.equal(at({ hasNetPrice: false })?.anchor, "edit");
assert.equal(at({})?.kind, "reserve");
assert.equal(at({ status: "reserved" })?.anchor, "summary");
assert.equal(at({ status: "reserved", hasSummary: true })?.anchor, "prepare");
assert.equal(at({ status: "reserved", hasSummary: true, hasBookingReceipt: true })?.title, "บันทึกสัญญาขายที่ลงนามแล้ว");
assert.equal(at({ pendingPayments: 2, status: "reserved" })?.anchor, "pending", "pending money outranks the stage step");
assert.equal(at({ pendingPayments: 1, can: { ...all, "financial.confirm": false } })?.allowed, false);
assert.equal(at({ status: "cancelled", plotHeld: true })?.anchor, "release");
assert.equal(at({ status: "cancelled" }), null);
assert.equal(at({ status: "contracted", isSettled: true })?.kind, "done");
const row = { label: "งวดงาน 1", needsAcceptance: true, accepted: false, hasInvoice: false, outstanding: true, isCreditCovered: false };
assert.match(at({ status: "contracted", instalment: row })?.title ?? "", /^ตรวจรับงาน/);
assert.match(at({ status: "contracted", instalment: { ...row, accepted: true } })?.title ?? "", /^ออกใบแจ้งชำระ/);
assert.match(at({ status: "contracted", instalment: { ...row, accepted: true, isCreditCovered: true } })?.title ?? "", /^บันทึกงวดที่ชำระครบด้วยเครดิตเดิม/);
assert.match(at({ status: "contracted", instalment: { ...row, accepted: true, hasInvoice: true } })?.title ?? "", /^รับชำระ/);
const bkp = { brand: "BAAN_KUNAPAP" as const };
assert.equal(at({ ...bkp })?.anchor, "design");
assert.equal(at({ ...bkp, hasDesignPlan: true })?.title, "จัดทำใบเสนอราคา");
assert.equal(at({ ...bkp, hasDesignPlan: true, hasNetPrice: false })?.task, "issue-quotation", "quotation captures its own price");
assert.equal(at({ ...bkp, hasNetPrice: false })?.anchor, "design", "design plan does not need a price");
assert.equal(at({ status: "reserved", hasSummary: true, isBookingDue: false })?.title, "บันทึกสัญญาขายที่ลงนามแล้ว", "no booking amount to collect");
assert.match(at({ ...bkp, hasDesignPlan: true, quotations: { offered: 1, accepted: 0 } })?.title ?? "", /ยอมรับ/);
assert.match(at({ ...bkp, quotations: { offered: 0, accepted: 1 } })?.title ?? "", /เตรียมสัญญา/);
assert.equal(at({ ...bkp, contract: "awaiting", quotations: { offered: 0, accepted: 1 } })?.title, "บันทึกลงนามสัญญา");

assert.equal(at({ ...bkp, contract: "draft", contractId: "draft-id" })?.task, "lock-contract");
const progressAt = (patch: Partial<NextStepInput>) => projectProgress({ ...base, ...patch });
assert.equal(progressAt({ status: "cancelled" }), null);
for (const [patch, current] of [
  [{ ...bkp }, 1], [{ ...bkp, hasDesignPlan: true }, 2],
  [{ ...bkp, contract: "awaiting" }, 3], [{ ...bkp, quotations: { offered: 0, accepted: 1 } }, 3],
  [{ ...bkp, status: "contracted" }, 4],
  [{}, 1], [{ status: "reserved" }, 2], [{ status: "reserved", hasSummary: true }, 3], [{ status: "contracted" }, 4],
] satisfies [Partial<NextStepInput>, number][]) {
  const progress = progressAt(patch);
  assert.equal(progress?.steps.length, 5, "Both brands use five stable milestones");
  assert.equal(progress?.current, current, JSON.stringify(patch));
  assert.equal(progress?.complete, false, "A current milestone does not mean the Project is complete");
  assert.equal(progressAt({ ...patch, pendingPayments: 2, refundsToAct: 1 })?.current, current, "Transient money/refund tasks must not move lifecycle progress");
}
for (const brand of ["BAAN_KUNAPAP", "TARAVILLE"] as const) {
  for (const patch of [{ status: "completed" }, { status: "contracted", isSettled: true }] satisfies Partial<NextStepInput>[]) {
    assert.equal(progressAt({ brand, ...patch })?.current, 4);
    assert.equal(progressAt({ brand, ...patch })?.complete, true);
  }
}

const pay = (amount: string, refunded = "0") => ({ amount_cents: amount, totals: { refunded_cents: refunded } });
assert.deepEqual(moneySummary({ net: "1000", payments: [pay("300", "100")], instalments: [] }), { net: "1000", received: "200", outstanding: "800" });
assert.deepEqual(moneySummary({ net: null, payments: [pay("300")], instalments: [] }), { net: null, received: "300", outstanding: null });
assert.equal(moneySummary({ net: "1", payments: [pay("5")], instalments: [] }).outstanding, "0");
assert.equal(moneySummary({ net: "9900000", payments: [pay("999900")], instalments: [], closeout: { remaining_cents: "0" } }).outstanding, "0", "Closed work uses the closeout balance, not the old contract price");
assert.equal(moneySummary({ net: "999", payments: [], instalments: [
  { is_active: true, net_cents: "100", balance: { outstanding_cents: "40" } }, { is_active: true, net_cents: "60", balance: null },
  { is_active: false, net_cents: "9", balance: null }] }).outstanding, "100");
console.log("case-progress ok");
