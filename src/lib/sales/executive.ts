import "server-only";
import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import { agreementSchema } from "./agreement-models";
import { bkpOverviewStage, bkpWorkflow } from "./bkp-workflow";
import { nextStep, projectProgress, type NextStep } from "./case-progress";
import { collectionRows } from "./finance-collection";
import { financialSchema } from "./financial-models";
import { brandSchema, capabilityLabels, caseSummarySchema } from "./models";
import { taskHref } from "./tasks";

type Client = Awaited<ReturnType<typeof requireStaff>>["supabase"];
const cents = z.string().regex(/^\d+$/);
const count = z.number().int().nonnegative();
const identity = z.object({ id: z.uuid(), code: z.string(), customer: z.string(), owner: z.string(),
  status: caseSummarySchema.shape.status });

const workRow = identity.extend({
  brand: brandSchema, updated_at: z.string(), waiting_since: z.string().nullish(),
  pending: count, acceptance: count, refunds: count, overdue: count, designOutstanding: z.boolean().optional(),
  input: z.object({
    hasNetPrice: z.boolean(), hasSummary: z.boolean(), hasBookingReceipt: z.boolean(), isBookingDue: z.boolean(), hasDesignPlan: z.boolean(),
    pendingPayments: count, refundsToAct: count, plotHeld: z.boolean(), isSettled: z.boolean(),
    quotations: z.object({ offered: count, accepted: count, offeredId: z.uuid().nullish() }),
    contract: z.enum(["none", "draft", "awaiting", "signed"]), contractId: z.uuid().nullish(),
    instalment: z.object({ id: z.uuid(), label: z.string(), needsAcceptance: z.boolean(), accepted: z.boolean(),
      hasInvoice: z.boolean(), outstanding: z.boolean(), isCreditCovered: z.boolean() }).nullable(),
  }),
});
const workSchema = workRow.array();
const executiveCapabilities = Object.fromEntries(Object.keys(capabilityLabels).map(action => [action, true]));
type WorkRow = z.infer<typeof workRow>;

function workPresentation({ input: facts, ...row }: WorkRow) {
  const input = { ...facts, brand: row.brand, status: row.status, can: executiveCapabilities,
    contractId: facts.contractId ?? undefined, quotations: { ...facts.quotations, offeredId: facts.quotations.offeredId ?? undefined } };
  const designRemaining = (row.status === "completed" || (row.status === "contracted" && facts.isSettled)) && row.designOutstanding;
  const progress = projectProgress(designRemaining ? { ...input, status: "contracted", isSettled: false } : input);
  const current = nextStep(input);
  const step: NextStep | null = designRemaining && current?.kind === "done"
    ? { title: "ติดตามค่าออกแบบ", tab: "money", anchor: "design-fees", allowed: true } : current;
  const caseHref = `/sales/${row.id}`;
  const href = step?.task ? taskHref(row.id, step.task, step.row)
    : step ? `${caseHref}?tab=${step.tab}${step.anchor ? `#${step.anchor}` : ""}` : caseHref;
  const isPreContract = row.status === "draft" || row.status === "reserved";
  const quotation = Number(row.brand === "BAAN_KUNAPAP" && isPreContract && facts.contract === "none" &&
    facts.quotations.accepted === 0 && facts.quotations.offered > 0);
  const signature = Number(isPreContract && facts.contract === "awaiting");
  const followUp = {
    quotation: quotation && input.quotations.offeredId ? taskHref(row.id, "accept-quotation", input.quotations.offeredId) : undefined,
    signature: signature && input.contractId ? taskHref(row.id, "sign-contract", input.contractId) : undefined,
    acceptance: row.acceptance > 0 ? `${caseHref}?tab=money#schedule` : undefined,
  };
  return { ...row, quotation, signature, followUp, stage: progress ? progress.steps[progress.current] : "ปิดงาน / ยกเลิก",
    action: step?.kind === "done" ? null : step ? { title: step.title, href } : null };
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
