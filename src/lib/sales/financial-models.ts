import { z } from "zod";
import { brandSchema, customerSnapshotSchema } from "./models";

const cents = z.string().regex(/^\d+$/);
export const paymentKinds = { design_fee: "ค่าออกแบบ", booking: "เงินจอง", instalment: "ค่างวด", unallocated: "เงินเข้าที่ยังไม่ระบุงวด" };
export const paymentMethods = { cash: "เงินสด", transfer: "โอนเงิน", cheque: "เช็คที่เรียกเก็บแล้ว" };
export const financialSchema = z.object({
  case_id: z.uuid(), version: z.number().int().positive(), issuer_ready: z.boolean(), can_change_design: z.boolean(),
  design_plan: z.object({ tier: z.string(), usable_area: z.string().nullable(), total_cents: cents,
    instalments: cents.array().length(3), note: z.string() }).nullable(),
  pending: z.object({ id: z.uuid(), kind: z.enum(["design_fee", "booking", "instalment", "unallocated"]),
    amount_cents: cents, method: z.enum(["cash", "transfer", "cheque"]), paid_date: z.string(), payer_name: z.string(),
    description: z.string(), proof_path: z.string().nullable() }).array(),
  payments: z.object({ id: z.uuid(), kind: z.string(), amount_cents: cents, method: z.string(), paid_date: z.string(),
    payer_name: z.string(), totals: z.record(z.string(), z.string()) }).array(),
  documents: z.object({ id: z.uuid(), kind: z.string(), number: z.string().nullable(), state: z.string(),
    document_date: z.string(), amount_cents: cents.nullable(), booking_cents: cents.nullish() }).array(),
});
export const issuerSchema = z.object({ brand: brandSchema, legal_name: z.string(), address: z.string(), tax_id: z.string(),
  contact: z.string(), contract_text: z.string(), is_synthetic: z.boolean(), version: z.number().int().positive() });
export const documentSchema = z.object({ id: z.uuid(), case_id: z.uuid(), kind: z.string(), number: z.string().nullable(),
  revision: z.number().int(), state: z.string(), document_date: z.string(),
  customer_snapshot: customerSnapshotSchema,
  issuer_snapshot: z.object({ legal_name: z.string(), address: z.string(), tax_id: z.string(), contact: z.string(), brand: brandSchema }),
  payload: z.object({ is_synthetic: z.boolean(), amount_cents: cents, kind: z.enum(["design_fee", "booking", "instalment", "unallocated"]),
    method: z.enum(["cash", "transfer", "cheque"]), paid_date: z.string(), payer_name: z.string(), description: z.string(), confirmed_by_name: z.string(),
    replaces_number: z.string().nullish(), replacement_reason: z.string().nullish() }),
  cancelled_at: z.string().nullable(), cancel_reason: z.string().nullable(),
});
export type FinancialDetail = z.infer<typeof financialSchema>;
export const savedDocumentSchema = documentSchema.omit({ payload: true }).extend({
  payload: z.record(z.string(), z.unknown()),
  adjustments: z.object({ document_id: z.uuid(), number: z.string(), amount_cents: z.string().regex(/^-?\d+$/) }).array().default([]),
});
