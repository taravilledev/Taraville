import { z } from "zod";
import type { StatusTone } from "@/components/status";
import type { Refund } from "./refund-models";

export const brandSchema = z.enum(["BAAN_KUNAPAP", "TARAVILLE"]);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const money = z.string().regex(/^\d+$/).nullable();
export const capabilityLabels = {
  "case.view": "ดูงาน/รายการขาย", "case.create": "เปิดงาน/รายการขาย", "case.edit": "แก้ข้อมูลงาน",
  "financial.view": "ดูข้อมูลและเอกสารการเงิน", "financial.prepare": "เตรียมข้อมูลและเงื่อนไขการขาย",
  "financial.confirm": "ยืนยันรับเงินจริง", "receipt.issue": "ออกใบเสร็จ", "receipt.cancel": "ยกเลิก/แก้เอกสารใบเสร็จ",
  "refund.request": "ขอคืนเงิน", "refund.approve": "อนุมัติคืนเงิน", "refund.pay": "บันทึกจ่ายคืน",
  "contract.sign": "บันทึกเซ็นสัญญา", "contract.amend": "แก้ไขข้อตกลงหลังเซ็น", "contract.cancel": "ยกเลิกสัญญา",
  "billing.issue": "ออกใบแจ้งชำระ", "acceptance.record": "บันทึกตรวจรับงาน", "catalog.manage": "จัดการโครงการหมู่บ้านและบ้าน/แปลง",
} as const;
export type Capability = keyof typeof capabilityLabels;
export const capabilitySchema = z.object({ action: z.enum(Object.keys(capabilityLabels) as [Capability, ...Capability[]]), enabled: z.boolean(), scope: z.enum(["own", "all"]) });
export const customerSnapshotSchema = z.object({ full_name: z.string(), phone: z.string().default(""), address: z.string().default(""), nickname: z.string().default(""), salesperson: z.string().default("") });
export const caseSummarySchema = z.object({
  id: z.uuid(), code: z.string(), brand: brandSchema, lead_id: z.uuid(), responsible_id: z.uuid(),
  status: z.enum(["draft", "reserved", "contracted", "completed", "cancelled"]),
  version, customer_name: z.string(), can_finance: z.boolean(),
});
export const unitSchema = z.object({ id: z.uuid(), code: z.string(), details: z.record(z.string(), z.unknown()), list_price_cents: money, is_active: z.boolean(), is_available: z.boolean(), version });
export const developmentSchema = z.object({ id: z.uuid(), name: z.string(), address: z.string(), is_active: z.boolean(), version, units: unitSchema.array() });
const count = z.number().int().nonnegative();
// Facts from private.sales_case_facts that projectProgress()/nextStep() read (ADR 0064).
export const caseFactsSchema = z.object({
  waiting_since: z.string().nullish(), pending: count, acceptance: count, refunds: count, overdue: count, designOutstanding: z.boolean().optional(),
  input: z.object({
    hasNetPrice: z.boolean(), hasSummary: z.boolean(), hasBookingReceipt: z.boolean(), isBookingDue: z.boolean(), hasDesignPlan: z.boolean(),
    pendingPayments: count, refundsToAct: count, plotHeld: z.boolean(), isSettled: z.boolean(),
    quotations: z.object({ offered: count, accepted: count, offeredId: z.uuid().nullish() }),
    contract: z.enum(["none", "draft", "awaiting", "signed"]), contractId: z.uuid().nullish(),
    instalment: z.object({ id: z.uuid(), label: z.string(), needsAcceptance: z.boolean(), accepted: z.boolean(),
      hasInvoice: z.boolean(), outstanding: z.boolean(), isCreditCovered: z.boolean() }).nullable(),
  }),
});
export type CaseFacts = z.infer<typeof caseFactsSchema>;
export const caseListRowSchema = caseSummarySchema.extend({
  detail: z.string().nullable(), owner: z.string(), updated_at: z.string(),
  permissions: z.record(z.string(), z.boolean()).nullable(), facts: caseFactsSchema.nullable(),
});
export type CaseListRow = z.infer<typeof caseListRowSchema>;
export const bootstrapSchema = z.object({
  actor: z.object({ id: z.uuid(), full_name: z.string(), role: z.enum(["sale", "executive", "staff"]) }),
  cases: caseSummarySchema.array(),
  leads: z.object({ id: z.uuid(), brand: brandSchema, full_name: z.string(), owner_id: z.uuid(), project_id: z.uuid().nullable(), project_code: z.string().nullable() }).array(),
  customers: z.object({ id: z.uuid(), brand: brandSchema, full_name: z.string(), phone: z.string() }).array(),
  developments: developmentSchema.array(),
  staff: z.object({ id: z.uuid(), full_name: z.string(), role: z.enum(["sale", "executive", "staff"]), is_active: z.boolean(), capabilities: capabilitySchema.array() }).array(),
  can_admin: z.boolean(), can_catalog: z.boolean(),
});
export const caseDetailSchema = caseSummarySchema.extend({
  project_id: z.uuid().nullable(), unit_id: z.uuid().nullable(), customer_id: z.uuid(),
  responsible_name: z.string(), lead_owner_name: z.string(), can_edit: z.boolean(), can_assign: z.boolean(),
  permissions: z.record(z.string(), z.boolean()), customer_snapshot: customerSnapshotSchema.optional(),
  details: z.record(z.string(), z.unknown()).optional(), list_price_cents: money.optional(),
  promotion_price_cents: money.optional(), discount_cents: money.optional(), net_price_cents: money.optional(),
  unit_label: z.string().nullish(),
  house_brief: z.record(z.string(), z.string()).nullish(),
});
export type SalesBootstrap = z.infer<typeof bootstrapSchema>;
export type SalesCase = z.infer<typeof caseDetailSchema>;
export const brandLabels = { BAAN_KUNAPAP: "บ้านคุณภาพ", TARAVILLE: "ธาราวิลล์" };
export const caseStatusLabels = { draft: "เตรียมข้อมูล", reserved: "จองแล้ว", contracted: "ทำสัญญาแล้ว", completed: "ครบยอดแล้ว", cancelled: "ยกเลิก" };
export type CaseStatus = keyof typeof caseStatusLabels;
export const caseStatusTones: Record<CaseStatus, StatusTone> = { draft: "progress", reserved: "progress", contracted: "progress", completed: "success", cancelled: "inactive" };
export const refundStates: Record<Refund["state"], { label: string; tone: StatusTone }> = {
  pending: { label: "รออนุมัติ", tone: "waiting" }, approved: { label: "อนุมัติ รอจ่าย", tone: "waiting" }, paid: { label: "จ่ายคืนแล้ว", tone: "success" },
  rejected: { label: "ไม่อนุมัติ", tone: "fix" }, withdrawn: { label: "ถอนคำขอ", tone: "inactive" },
};
export const workQueueKinds = { payment_pending: "เงินเข้ารอยืนยัน", refund_pending: "คำขอคืนเงินรออนุมัติ", refund_approved: "อนุมัติคืนเงินแล้ว รอจ่ายจริง", acceptance: "รอตรวจรับงาน", design_fee: "ค่าแบบค้าง" };
export const workQueueSchema = z.object({ case_id: z.uuid(), code: z.string(), brand: brandSchema, customer_name: z.string().nullable(),
  kind: z.enum(["payment_pending", "refund_pending", "refund_approved", "acceptance", "design_fee"]), count: z.number().int(), since: z.string(),
  overdue: z.number().int().default(0) }).array();
