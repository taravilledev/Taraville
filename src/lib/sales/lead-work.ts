import "server-only";
import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import { loadCaseData } from "./case-loader";
import { caseDetailSchema, caseStatusLabels } from "./models";

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

const statusSchema = z.enum(["draft", "reserved", "contracted", "completed", "cancelled"]);
const workSchema = z.object({
  can_create: z.boolean(),
  cases: z.object({ id: z.uuid().nullable(), code: z.string(), status: statusSchema, brand: z.enum(["BAAN_KUNAPAP", "TARAVILLE"]),
    project_id: z.uuid().nullable(), can_open: z.boolean(), can_finance: z.boolean() }).array(),
});
const tagsSchema = z.record(z.uuid(), z.object({ count: z.number().int(), status: statusSchema, plot_code: z.string().nullable() }));
export type LeadCase = z.infer<typeof workSchema>["cases"][number];
export type LeadCaseDetail = { plot: string | null; nextStep: string | null; outstanding: string | null };
export type LeadWork = { canCreate: boolean; cases: (LeadCase & { detail: LeadCaseDetail | null })[] };

/** Financial extras for a case card. Any failure drops them: the card keeps its status-only form. */
async function caseDetail(supabase: Supabase, id: string): Promise<LeadCaseDetail | null> {
  try {
    const { data, error } = await supabase.rpc("sales_case_detail", { p_case_id: id });
    if (error) return null;
    const sale = caseDetailSchema.parse(data);
    const { step, summary } = await loadCaseData(supabase, sale);
    return { plot: sale.unit_label ?? null, nextStep: step?.title ?? null, outstanding: summary?.outstanding ?? null };
  } catch { return null; }
}

/** Customer Work of one Lead; null when the read fails so the Lead page still renders. */
export async function leadWork(supabase: Supabase, leadId: string): Promise<LeadWork | null> {
  const { data, error } = await supabase.rpc("sales_cases_for_lead", { p_lead_id: leadId });
  const parsed = error ? null : workSchema.safeParse(data);
  if (!parsed?.success) return null;
  const cases = await Promise.all(parsed.data.cases.map(async row => ({
    ...row, detail: row.can_finance && row.id ? await caseDetail(supabase, row.id) : null })));
  return { canCreate: parsed.data.can_create, cases };
}

/** One call for a whole page of the Lead list; empty when it fails so the tag simply hides. */
export async function leadTags(supabase: Supabase, leadIds: string[]) {
  if (!leadIds.length) return new Map<string, string>();
  const { data, error } = await supabase.rpc("sales_lead_tags", { p_lead_ids: leadIds });
  const parsed = error ? null : tagsSchema.safeParse(data);
  const tags = new Map<string, string>();
  if (!parsed?.success) return tags;
  for (const [id, tag] of Object.entries(parsed.data)) {
    tags.set(id, tag.count > 1 ? `${tag.count} งาน` : `${tag.plot_code ? `${tag.plot_code} · ` : ""}${caseStatusLabels[tag.status]}`);
  }
  return tags;
}
