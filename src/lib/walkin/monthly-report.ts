import { z } from "zod";
import { STAGE_GROUP_CODES, stageSchema, type StageGroup } from "./lead-stage";

export const REPORT_BRAND_LABELS = { TARAVILLE: "ธาราวิลล์", BAAN_KUNAPAP: "บ้านคุณภาพ" } as const;

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
    project_counts: z.object({ open: z.number().int().nonnegative(), closed: z.number().int().nonnegative() }).optional(),
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

/** Buddhist-era date on the Asia/Bangkok calendar, as the rest of the app. */
export const thaiDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

export function summarizeSelectedLeads(leads: readonly Pick<MonthlyReport["leads"][number], "brand" | "is_synthetic" | "project_counts">[]) {
  const byBrand = {
    TARAVILLE: { total: 0, open: 0, closed: 0, hasProjectCounts: true },
    BAAN_KUNAPAP: { total: 0, open: 0, closed: 0, hasProjectCounts: true },
  };
  let synthetic = 0;

  for (const lead of leads) {
    if (lead.is_synthetic) {
      synthetic++;
      continue;
    }
    const counts = byBrand[lead.brand];
    counts.total++;
    if (lead.project_counts) {
      counts.open += lead.project_counts.open;
      counts.closed += lead.project_counts.closed;
    } else {
      counts.hasProjectCounts = false;
    }
  }

  return { byBrand, synthetic };
}

/** `by_stage` folds into the three `/leads` tab groups; the RPC keeps returning raw stage codes. */
export function foldStageGroups(byStage: Record<string, number>): Record<StageGroup, number> {
  const sum = (group: StageGroup) => STAGE_GROUP_CODES[group].reduce((total, code) => total + (byStage[code] ?? 0), 0);
  return { open: sum("open"), project: sum("project"), closed: sum("closed") };
}

type SortableLead = Pick<MonthlyReport["leads"][number], "name" | "created_at">;

/** Client-side sort of the full row list: by registration time or by Thai name. */
export function sortLeads<T extends SortableLead>(leads: readonly T[], key: "date" | "name", isAscending: boolean) {
  const direction = isAscending ? 1 : -1;
  return [...leads].sort((a, b) => direction * (key === "name" ? a.name.localeCompare(b.name, "th") : a.created_at.localeCompare(b.created_at)));
}

/** Owners by Lead count, largest first; ties by Thai name. */
export const rankOwners = (owners: MonthlyReport["summary"]["by_owner"]) =>
  [...owners].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
