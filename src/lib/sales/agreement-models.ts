import { z } from "zod";
import { contractPaperSchema, contractAddendumSchema } from "./contract-paper";
import { customerSnapshotSchema } from "./models";
import { contractScheduleInputSchema, quoteHouseSchema, quoteSpecSchema, quotationPaperSchema } from "./agreement-inputs";

const cents = z.string().regex(/^\d+$/);
export const scheduleRowSchema = z.object({ position: z.number().int(), label: z.string(), gross_cents: cents, credit_cents: cents,
  net_cents: cents, progress_percent: z.number().int().nullish().transform(value => value ?? null), needs_acceptance: z.boolean(),
  basis_points: z.number().int().optional(), work_description: z.string().optional() });
export const agreementPayloadSchema = z.object({
  description: z.string().optional(), total_cents: cents.optional(), credit_cents: cents.optional(),
  design_fee_separate: z.boolean().optional(),
  contract_text: z.string().optional(), schedule: scheduleRowSchema.array().optional(),
  house: quoteHouseSchema.optional(), spec_rows: quoteSpecSchema.array().optional(), exclusions: z.string().array().optional(),
  details: z.record(z.string(), z.unknown()).optional(), price_set: z.boolean().optional(),
  paper: quotationPaperSchema.optional(),
  customer: z.object({ full_name: z.string(), phone: z.string().default(""), site_address: z.string().default("") }).optional(),
  start_date: z.string().optional(), additional_terms: z.string().optional(),
  contract_paper: contractPaperSchema.optional(), contract_text_approved: z.boolean().optional(),
  text_addendum: contractAddendumSchema.optional(), contract_number: z.string().nullable().optional(),
  schedule_input: contractScheduleInputSchema.extend({ label: z.string(), basis_points: z.number().int().min(0).max(10000) }).array().optional(),
  replaces_document_id: z.uuid().optional(),
});
export const agreementSchema = z.object({
  is_settled: z.boolean(),
  documents: z.object({ id: z.uuid(), kind: z.string(), state: z.string(), number: z.string().nullable(), revision: z.number().int(),
    version: z.number().int().positive().default(1), parent_id: z.uuid().nullable().optional(),
    customer_snapshot: customerSnapshotSchema.optional(),
    evidence_path: z.string().nullable(), payload: agreementPayloadSchema }).array(),
  instalments: scheduleRowSchema.extend({ id: z.uuid(), contract_id: z.uuid(), is_active: z.boolean(), accepted_at: z.string().nullable(),
    acceptance_date: z.iso.date().nullable().optional(), due_date: z.iso.date().nullable().optional(),
    acceptance_path: z.string().nullable(), invoice_id: z.uuid().nullable(), invoice_document_id: z.uuid().nullable(),
    balance: z.object({ outstanding_cents: cents, allocated_cents: cents, net_cents: z.string(), is_active: z.boolean() }).nullable() }).array(),
});
export type AgreementDetail = z.infer<typeof agreementSchema>;
