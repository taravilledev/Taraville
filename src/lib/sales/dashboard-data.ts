import "server-only";
import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import { brandSchema } from "./models";
import type { ExecutiveWork } from "./executive";

type Client = Awaited<ReturnType<typeof requireStaff>>["supabase"];
const cents = z.string().regex(/^\d+$/);
const count = z.number().int().nonnegative();
const overviewSchema = z.object({
  leadsTotal: count, signedTotal: cents, signedCount: count, received: z.string().regex(/^-?\d+$/), pending: count, dueCount: count,
  leads: z.object({ id: z.uuid(), customer: z.string(), brand: brandSchema, created_at: z.string(), owner: z.string() }).array(),
  due: z.object({ id: z.uuid(), case_id: z.uuid(), code: z.string(), customer: z.string(), brand: brandSchema,
    label: z.string(), due_date: z.iso.date(), outstanding: cents, group: z.enum(["design", "contract"]), document_id: z.uuid().nullable() }).array(),
  stageSince: z.record(z.uuid(), z.object({ quotation: z.string().nullable(), signature: z.string().nullable(),
    acceptance: z.string().nullable() })).default({}),
});

export type DashboardOverviewData = z.infer<typeof overviewSchema>;
export const followUpGroups = [
  { key: "quotation", label: "รอลูกค้ายืนยันใบเสนอราคา" },
  { key: "signature", label: "สัญญารอลงนาม" },
  { key: "acceptance", label: "งวดรอตรวจรับ" },
] as const;

export async function dashboardOverview(supabase: Client, brand: string) {
  const { data, error } = await supabase.rpc("sales_dashboard_overview", { p_brand: brand || null });
  const parsed = error ? null : overviewSchema.safeParse(data);
  return parsed?.success ? parsed.data : null;
}

export function dashboardFollowUps(rows: ExecutiveWork[], overview: DashboardOverviewData, brand: string) {
  return followUpGroups.map(({ key, label }) => {
    const matches = rows.filter(row => row[key] > 0).map(row => ({ row, since: overview.stageSince[row.id]?.[key] ?? null }));
    const dated = matches.filter((match): match is { row: ExecutiveWork; since: string } => match.since !== null)
      .sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
    const sample = dated[0] ?? matches[0];
    const query = new URLSearchParams({ attention: key });
    if (brand) query.set("brand", brand);
    return { label, count: matches.length, href: `/sales?${query}#projects-title`,
      project: sample ? { code: sample.row.code, customer: sample.row.customer, owner: sample.row.owner,
        href: sample.row.followUp[key] ?? `/sales/${sample.row.id}?tab=overview`, waitingSince: sample.since } : undefined };
  });
}
