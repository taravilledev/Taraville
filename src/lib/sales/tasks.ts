// Registry of the one-task-per-view pages at /sales/[id]?task=<name>[&row=<id>].
// Pure on purpose: the next step, the task lists and the page guard all read this one function.
import type { DesignFacts } from "./case-progress";
export const taskLabels = {
  "edit-case": "แก้ข้อมูลการขาย", reserve: "ยืนยันจองแปลง", design: "กำหนดค่าออกแบบ",
  "issue-quotation": "ออกใบเสนอราคา", "accept-quotation": "บันทึกลูกค้ายอมรับใบเสนอราคา", "prepare-contract": "เตรียมสัญญาสำหรับลงนาม",
  "sign-contract": "บันทึกลงนามสัญญา", "booking-summary": "บันทึกสรุปการจอง", "sign-property-contract": "บันทึกสัญญาขายที่ลงนามแล้ว",
  "contract-addendum": "เพิ่มข้อตกลงแนบท้ายสัญญา",
  "edit-contract": "แก้ร่างสัญญา", "lock-contract": "ล็อกสัญญาเพื่อเซ็น", "unlock-contract": "ปลดล็อกเพื่อแก้ร่าง",
  "prepare-payment": "บันทึกเงินเข้า", "prepare-instalment": "บันทึกเงินเข้างวดนี้", "withdraw-payment": "ถอนรายการรับเงิน",
  "confirm-payment": "ตรวจใบเสร็จและยืนยันรับเงิน",
  "issue-design-invoice": "ออกใบแจ้งชำระค่าออกแบบ", "prepare-design-payment": "บันทึกรับเงินค่าออกแบบ", "cancel-design-invoice": "ยกเลิกใบแจ้งชำระค่าออกแบบ",
  "fix-receipt": "แก้ใบเสร็จที่ผิด", "issue-invoice": "ออกใบแจ้งชำระ", acceptance: "บันทึกผลตรวจรับงาน",
  "change-unit": "เปลี่ยนแปลงที่จอง", amend: "บันทึกข้อตกลงแก้ไขสัญญา", close: "บันทึกข้อตกลงปิดงาน", release: "ปล่อยแปลงหลังปิดงาน",
  assign: "เปลี่ยนผู้รับผิดชอบงาน", "request-refund": "ขอคืนเงิน", "decide-refund": "พิจารณาคำขอคืนเงิน", "pay-refund": "บันทึกจ่ายคืนเงินจริง",
} as const;
export type TaskName = keyof typeof taskLabels;
export const taskNames = Object.keys(taskLabels) as TaskName[];
export type Task = { name: TaskName; row?: string; label: string; group: "main" | "exception" };

export type TaskContext = {
  brand: "BAAN_KUNAPAP" | "TARAVILLE"; status: "draft" | "reserved" | "contracted" | "completed" | "cancelled";
  can: Record<string, boolean>; canAssign: boolean; hasNetPrice: boolean;
  design: { canChange: boolean; amounts?: string[]; legacyReceived?: string; legacyLocked?: boolean; bills?: {
    id: string; position: number; state: string; pendingId: string | null; received: string; hasConfirmed?: boolean;
  }[] };
  summaryCount: number; hasPayments: boolean; plotHeld: boolean; unitOptions: number;
  pendingPaymentIds: string[]; receipts: { id: string; state: string }[];
  quotations: { id: string; state: string; hasPrice?: boolean }[];
  contracts: { id: string; state: string; hasSeparateDesignFee?: boolean }[];
  instalments: { id: string; needsAcceptance: boolean; accepted: boolean; hasInvoice: boolean; canReceive: boolean }[];
  workAcceptance: { id: string; accepted: boolean }[]; // acceptance rows for users without financial access
  refunds: { id: string; state: string; isMine: boolean }[];
};

type DesignBill = NonNullable<TaskContext["design"]["bills"]>[number];
const issuedDesignBill = (ctx: TaskContext, position: number) => ctx.design.bills?.find(item => item.position === position && item.state === "issued");
const isOpenDesignBill = (bill: DesignBill) => !bill.pendingId && !bill.hasConfirmed && bill.received === "0";

/** BKP design fees are collected before the contract, or after it only when the signed contract keeps them separate (ADR 0046). */
export function canCollectDesign(ctx: Pick<TaskContext, "status" | "contracts" | "design">) {
  const preContract = ctx.status === "draft" || ctx.status === "reserved";
  const signed = ctx.contracts.filter(item => item.state === "signed");
  const allowed = signed.length
    ? signed.every(item => item.hasSeparateDesignFee === true) && (preContract || ctx.status === "contracted" || ctx.status === "completed")
    : preContract;
  return allowed && !ctx.design.legacyLocked && BigInt(ctx.design.legacyReceived ?? "0") === BigInt(0);
}

/** The design-fee facts nextStep() walks (ADR 0058), from the same guard the task pages use. */
export function designFacts(ctx: TaskContext, flow: { feesPaid: boolean; hasQuotation: boolean }): DesignFacts {
  return { ...flow, canCollect: canCollectDesign(ctx), instalments: (ctx.design.amounts ?? []).map((amount, index) => {
    const bill = issuedDesignBill(ctx, index + 1);
    return { amount, bill: !bill ? "none" : isOpenDesignBill(bill) ? "open" : "settled", billId: bill?.id };
  }) };
}

export function availableTasks(ctx: TaskContext): Task[] {
  const { can, status, brand } = ctx;
  const out: Task[] = [];
  const add = (name: TaskName, row?: string, group: Task["group"] = "main") => out.push({ name, row, label: taskLabels[name], group });
  const prepare = can["financial.prepare"]; const preContract = status === "draft" || status === "reserved";
  if (prepare && preContract) add("edit-case");
  if (brand === "TARAVILLE" && status === "draft" && ctx.hasNetPrice && prepare) add("reserve");
  if (brand === "BAAN_KUNAPAP") {
    if ((status === "contracted" || status === "completed") && can["financial.view"] && can["contract.amend"])
      for (const doc of ctx.contracts.filter(item => item.state === "signed")) add("contract-addendum", doc.id);
    const hasContract = ctx.contracts.some(item => ["draft", "awaiting_signature", "signed"].includes(item.state));
    const hasLockedContract = ctx.contracts.some(item => ["awaiting_signature", "signed"].includes(item.state));
    if (prepare && ctx.design.canChange) add("design");
    if (canCollectDesign(ctx)) {
      for (const [index, amount] of (ctx.design.amounts ?? []).entries()) {
        const bill = issuedDesignBill(ctx, index + 1);
        if (BigInt(amount) > BigInt(0) && !bill && can["billing.issue"]) add("issue-design-invoice", String(index + 1));
        if (bill && isOpenDesignBill(bill)) {
          if (prepare) add("prepare-design-payment", bill.id);
          if (can["billing.issue"]) add("cancel-design-invoice", bill.id);
        }
      }
    }
    if (prepare && preContract && !hasLockedContract) add("issue-quotation");
    if (prepare && preContract) for (const doc of ctx.quotations.filter(item => item.state === "offered" && item.hasPrice !== false)) add("accept-quotation", doc.id);
    if (prepare && preContract && !hasContract && ctx.quotations.some(item => item.state === "accepted" && item.hasPrice !== false)) add("prepare-contract");
    if (prepare && preContract) for (const doc of ctx.contracts) {
      if (doc.state === "draft") { add("edit-contract", doc.id); add("lock-contract", doc.id); }
      if (doc.state === "awaiting_signature") add("unlock-contract", doc.id);
    }
    if (can["contract.sign"] && preContract) for (const doc of ctx.contracts.filter(item => item.state === "awaiting_signature")) add("sign-contract", doc.id);
  } else {
    if (prepare && ctx.hasNetPrice && preContract) add("booking-summary");
    if (status === "reserved" && can["contract.sign"] && ctx.summaryCount > 0) add("sign-property-contract");
  }
  if (prepare) add("prepare-payment");
  if (prepare) for (const row of ctx.instalments.filter(item => item.canReceive)) add("prepare-instalment", row.id);
  if (prepare) for (const id of ctx.pendingPaymentIds) add("withdraw-payment", id);
  if (can["financial.confirm"] && can["receipt.issue"]) for (const id of ctx.pendingPaymentIds) add("confirm-payment", id);
  const canCorrectPayment = ["financial.prepare", "financial.confirm", "receipt.cancel", "receipt.issue"].every(key => can[key]);
  for (const doc of ctx.receipts) {
    if ((can["receipt.cancel"] && (doc.state === "issued" || can["receipt.issue"])) || (doc.state === "issued" && canCorrectPayment)) add("fix-receipt", doc.id);
  }
  if (status === "contracted") {
    for (const row of ctx.instalments) {
      if (can["billing.issue"] && !row.hasInvoice && (!row.needsAcceptance || row.accepted)) add("issue-invoice", row.id);
      if (can["acceptance.record"] && row.needsAcceptance && !row.accepted) add("acceptance", row.id);
    }
    for (const row of ctx.workAcceptance) if (can["acceptance.record"] && !row.accepted) add("acceptance", row.id);
  }
  const canAmend = status === "contracted" && can["contract.amend"] && ctx.instalments.length > 0;
  const canClose = status !== "cancelled" && can["contract.cancel"];
  if (ctx.unitOptions > 0 && ((status === "reserved" && prepare) || (status === "contracted" && can["contract.amend"]))) add("change-unit", undefined, "exception");
  if (canAmend) add("amend", undefined, "exception");
  if (canClose) add("close", undefined, "exception");
  if (ctx.plotHeld && status === "cancelled" && can["contract.cancel"]) add("release", undefined, "exception");
  if (ctx.canAssign) add("assign", undefined, "exception");
  if (can["refund.request"] && ctx.hasPayments) add("request-refund", undefined, "exception");
  for (const refund of ctx.refunds) {
    if (refund.state === "pending" && ((refund.isMine && can["refund.request"]) || (!refund.isMine && can["refund.approve"]))) add("decide-refund", refund.id);
    if (refund.state === "approved" && can["refund.pay"]) add("pay-refund", refund.id);
  }
  return out;
}

export const findTask = (tasks: Task[], name: string | undefined, row: string | undefined) =>
  tasks.find(task => task.name === name && task.row === row);
export const taskHref = (caseId: string, name: TaskName, row?: string) =>
  `/sales/${caseId}?task=${name}${row ? `&row=${row}` : ""}`;
