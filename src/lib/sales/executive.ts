import "server-only";
import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import { agreementSchema } from "./agreement-models";
import { bkpOverviewStage, bkpWorkflow } from "./bkp-workflow";
import { caseWork } from "./case-work";
import { collectionRows } from "./finance-collection";
import { financialSchema } from "./financial-models";
import { brandSchema, capabilityLabels, caseFactsSchema, caseSummarySchema } from "./models";

type Client = Awaited<ReturnType<typeof requireStaff>>["supabase"];
const cents = z.string().regex(/^\d+$/);
const identity = z.object({ id: z.uuid(), code: z.string(), customer: z.string(), owner: z.string(),
  status: caseSummarySchema.shape.status });

const workRow = identity.extend({ brand: brandSchema, updated_at: z.string() }).extend(caseFactsSchema.shape);
const workSchema = workRow.array();
const executiveCapabilities = Object.fromEntries(Object.keys(capabilityLabels).map(action => [action, true]));

function workPresentation(row: z.infer<typeof workRow>) {
  const { id, code, customer, owner, status, brand, updated_at } = row;
  return { id, code, customer, owner, status, brand, updated_at, ...caseWork(row, row, executiveCapabilities) };
}

export async function executiveWork(supabase: Client, filters: { brand: string; status: string; query: string }) {
  const { data, error } = await supabase.rpc("sales_executive_work", {
    p_brand: filters.brand || null, p_status: filters.status, p_query: filters.query || null,
  });
  const parsed = error ? null : workSchema.safeParse(data);
  return parsed?.success ? parsed.data.map(workPresentation) : null;
}

export type ExecutiveWork = NonNullable<Awaited<ReturnType<typeof executiveWork>>>[number];

const summarySchema = identity.extend({
  value: cents.nullable(), received: z.string().regex(/^-?\d+$/), received_total: z.string().regex(/^-?\d+$/).optional(),
  closeout: cents,
  finance: financialSchema, agreement: agreementSchema,
}).array();

export async function executiveSummary(supabase: Client, { from, to }: { from: string | null; to: string | null }) {
  const { data, error } = await supabase.rpc("sales_executive_summary", { p_from: from, p_to: to });
  const parsed = error ? null : summarySchema.safeParse(data);
  if (!parsed?.success) return null;
  return parsed.data.map(({ finance, agreement, received_total, ...project }) => ({
    ...project,
    receivedTotal: received_total ?? (from || to ? null : project.received),
    stage: project.status === "cancelled" ? "cancelled" as const
      : received_total === undefined ? "unknown" as const : bkpOverviewStage(bkpWorkflow(finance, agreement)),
    pending: finance.pending.reduce((total, item) => total + BigInt(item.amount_cents), BigInt(0)).toString(),
    rows: collectionRows(project.id, finance, agreement, [], project.status === "cancelled").map(row => ({
      id: row.id, group: row.group, label: row.label, amount: row.amountCents, outstanding: row.outstandingCents,
      due: row.dueDate, billed: row.group === "design" ? row.links.some(link => link.label === "ดูบิล")
        : agreement.instalments.some(item => item.id === row.id && item.invoice_id !== null),
      reference: row.isReference ?? false, status: row.status,
    })),
  }));
}

export type ExecutiveProject = NonNullable<Awaited<ReturnType<typeof executiveSummary>>>[number];
