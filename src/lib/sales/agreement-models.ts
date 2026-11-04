import { z } from "zod";

const cents = z.string().regex(/^\d+$/);
export const scheduleRowSchema = z.object({ position: z.number().int(), label: z.string(), gross_cents: cents, credit_cents: cents,
  net_cents: cents, progress_percent: z.number().int().nullable(), needs_acceptance: z.boolean() });
export const agreementSchema = z.object({
  is_settled: z.boolean(),
  documents: z.object({ id: z.uuid(), kind: z.string(), state: z.string(), number: z.string().nullable(), revision: z.number().int(),
    evidence_path: z.string().nullable(), payload: z.object({ description: z.string().optional(), total_cents: cents.optional(),
      credit_cents: cents.optional(), contract_text: z.string().optional(), schedule: scheduleRowSchema.array().optional() }) }).array(),
  instalments: scheduleRowSchema.extend({ id: z.uuid(), contract_id: z.uuid(), is_active: z.boolean(), accepted_at: z.string().nullable(),
    acceptance_path: z.string().nullable(), invoice_id: z.uuid().nullable(), invoice_document_id: z.uuid().nullable(),
    balance: z.object({ outstanding_cents: cents, allocated_cents: cents, net_cents: z.string(), is_active: z.boolean() }).nullable() }).array(),
});
export type AgreementDetail = z.infer<typeof agreementSchema>;
