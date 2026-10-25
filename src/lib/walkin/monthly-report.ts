import { z } from "zod";
import { stageSchema } from "./lead-stage";

const brandSchema = z.enum(["BAAN_KUNAPAP", "TARAVILLE"]);

/** Shape returned by `walkin_monthly_report` (ADR 0014). */
export const reportSchema = z.object({
  summary: z.object({
    total: z.number(), synthetic: z.number(), contacted: z.number(), closed: z.number(), project_opened: z.number(),
    by_brand: z.record(z.string(), z.number()), by_stage: z.record(z.string(), z.number()),
    by_owner: z.array(z.object({ owner_id: z.uuid(), name: z.string(), count: z.number() })),
  }),
  leads: z.array(z.object({
    id: z.uuid(), brand: brandSchema, name: z.string(), phone: z.string(), stage: stageSchema, owner: z.string(),
    is_synthetic: z.boolean(), created_at: z.string(),
  })),
  owners: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export type MonthlyReport = z.infer<typeof reportSchema>;

export const reportFiltersSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  brand: brandSchema.optional(), owner: z.uuid().optional(),
});

/** Current month as YYYY-MM on the Asia/Bangkok calendar. */
export const currentMonth = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).slice(0, 7);

/** "ตุลาคม 2569" for a YYYY-MM value (Buddhist year, as the rest of the app). */
export function monthLabel(month: string) {
  return new Date(`${month}-15T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", month: "long", year: "numeric" });
}
