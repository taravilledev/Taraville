import { z } from "zod";
import { contractPaperSchema } from "./contract-paper";

const text = (length: number) => z.string().trim().max(length);
const count = z.string().regex(/^\d{1,3}$/);
const cents = z.string().regex(/^\d{1,19}$/).refine(value => BigInt(value) > BigInt(0) && BigInt(value) <= BigInt("9223372036854775807"));
export const quoteHouseSchema = z.object({
  model: text(200).min(1),
  stories: z.string().regex(/^[1-9]\d{0,2}$/),
  bedrooms: count, kitchens: count, bathrooms: count,
  usable_area: z.string().regex(/^\d{1,9}(?:\.\d{1,3})?$/).refine(value => Number(value) > 0),
});
export const quoteSpecSchema = z.object({ item: text(200).min(1), detail: text(3000), note: text(1000) });
export const quotationPaperSchema = z.object({
  schema_version: z.literal(1), customer_name: text(200).min(1), customer_phone: text(80), customer_address: text(2000),
  site_address: text(2000), salesperson: text(200), manager: text(200),
  work_type: z.enum(["", "รับสร้างบ้าน", "ต่อเติม", "ปรับปรุง", "อื่นๆ"]), document_date: z.iso.date(), footnote: text(3000),
}).strict();
export const quotationInputSchema = z.object({
  house: quoteHouseSchema, total_cents: cents.nullable(),
  spec_rows: quoteSpecSchema.array().max(50), exclusions: text(2000).min(1).array().max(50),
  description: text(10000).optional(), paper: quotationPaperSchema.optional(),
}).strict();

export const contractCustomerSchema = z.object({
  full_name: text(200).min(1), phone: text(80).min(1), site_address: text(2000).min(1),
}).strict();
export const contractScheduleInputSchema = z.object({
  label: text(300).min(1), basis_points: z.number().int().min(1).max(10000),
  progress_percent: z.number().int().min(0).max(100).nullish().transform(value => value ?? null), work_description: text(3000).default(""),
}).strict();
export const contractInputSchema = z.object({
  customer: contractCustomerSchema, start_date: z.union([z.literal(""), z.iso.date()]), additional_terms: text(10000).optional(), contract_paper: contractPaperSchema.optional(),
  schedule: contractScheduleInputSchema.array().min(1).max(100),
}).strict().superRefine(({ schedule, contract_paper, start_date }, ctx) => {
  if (!contract_paper && !start_date) ctx.addIssue({ code: "custom", message: "เลือกวันเริ่มสัญญา", path: ["start_date"] });
  if (schedule.reduce((sum, row) => sum + row.basis_points, 0) !== 10000) {
    ctx.addIssue({ code: "custom", message: "สัดส่วนงวดต้องรวม 100%", path: ["schedule"] });
  }
  let previous = 0;
  schedule.forEach((row, index) => {
    if (index === 0 ? row.progress_percent !== null : row.progress_percent === null || row.progress_percent < previous) {
      ctx.addIssue({ code: "custom", message: "ตรวจความคืบหน้างานของแต่ละงวด", path: ["schedule", index, "progress_percent"] });
    }
    previous = row.progress_percent ?? 0;
  });
});

export function agreementFormInput(value: FormDataEntryValue | null, maxLength = 120000): unknown {
  if (typeof value !== "string" || value.length > maxLength) return null;
  try { return JSON.parse(value); } catch { return null; }
}
