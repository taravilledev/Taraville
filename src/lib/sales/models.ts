import { z } from "zod";

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
export const caseListRowSchema = caseSummarySchema.extend({ detail: z.string().nullable() });
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
});
export type SalesBootstrap = z.infer<typeof bootstrapSchema>;
export type SalesCase = z.infer<typeof caseDetailSchema>;
export const brandLabels = { BAAN_KUNAPAP: "บ้านคุณภาพ", TARAVILLE: "ธาราวิลล์" };
export const caseStatusLabels = { draft: "เตรียมข้อมูล", reserved: "จองแล้ว", contracted: "ทำสัญญาแล้ว", completed: "ครบยอดแล้ว", cancelled: "ยกเลิก" };
