import "server-only";
import { z } from "zod";
import type { requireStaff } from "@/lib/supabase/staff";
import { financialSchema } from "./financial-models";
import { agreementSchema } from "./agreement-models";
import { refundSchema } from "./refund-models";
import { moneySummary, nextStep } from "./case-progress";
import type { SalesCase } from "./models";

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

const workSchema = z.object({ id: z.uuid(), position: z.number().int(), progress_percent: z.number().nullable(), accepted: z.boolean() }).array();
const closeoutSchema = z.object({ document_id: z.uuid(), retained_cents: z.string(), received_cents: z.string(),
  remaining_cents: z.string(), refund_due_cents: z.string() }).nullable();
const reservationSchema = z.object({ active: z.boolean(), options: z.object({ id: z.uuid(), label: z.string() }).array() });

/** Runs one case-scoped read only when `when` holds, and fails with a message the page can show. */
async function read<T>(supabase: Supabase, when: boolean, name: string, caseId: string, failure: string, parse: (data: unknown) => T) {
  if (!when) return null;
  const { data, error } = await supabase.rpc(name, { p_case_id: caseId });
  if (error) throw new Error(failure);
  return parse(data);
}

/** Everything the case summary and the Lead card derive from one case. Finance reads run only for `can_finance`. */
export async function loadCaseData(supabase: Supabase, sale: SalesCase) {
  const id = sale.id; const canFinance = sale.can_finance;
  const [workRead, financeRead, agreementRead, closeoutRead, reservationRead, refundRead] = await Promise.all([
    read(supabase, !canFinance && sale.brand === "BAAN_KUNAPAP" && sale.status === "contracted" && sale.permissions["acceptance.record"],
      "sales_acceptance_detail", id, "โหลดรายการตรวจรับไม่ได้ กรุณาลองใหม่", data => workSchema.parse(data)),
    read(supabase, canFinance, "sales_financial_detail", id, "โหลดข้อมูลรับเงินไม่ได้ กรุณาลองใหม่", data => financialSchema.parse(data)),
    read(supabase, canFinance, "sales_agreement_detail", id, "โหลดข้อมูลสัญญาไม่ได้ กรุณาลองใหม่", data => agreementSchema.parse(data)),
    read(supabase, canFinance && sale.status === "cancelled", "sales_closeout_detail", id, "โหลดยอดปิดงานไม่ได้ กรุณาลองใหม่", data => closeoutSchema.parse(data ?? null)),
    read(supabase, canFinance && sale.brand === "TARAVILLE", "sales_reservation_detail", id, "โหลดสถานะจองไม่ได้ กรุณาลองใหม่", data => reservationSchema.parse(data)),
    read(supabase, canFinance, "sales_refund_detail", id, "โหลดข้อมูลคืนเงินไม่ได้ กรุณาลองใหม่", data => refundSchema.array().parse(data)),
  ]);
  const work = workRead ?? []; const finance = financeRead; const agreement = agreementRead;
  const closeout = closeoutRead; const reservation = reservationRead; const refunds = refundRead ?? [];

  const pending = finance?.pending.length ?? 0;
  const rows = (agreement?.instalments ?? []).filter(row => row.is_active).sort((a, b) => a.position - b.position);
  const row = rows.find(item => item.balance?.outstanding_cents !== "0");
  const contract = agreement?.documents.find(doc => doc.kind === "contract" && ["awaiting_signature", "signed"].includes(doc.state));
  const quotations = agreement?.documents.filter(doc => doc.kind === "quotation") ?? [];
  const summary = finance && agreement ? moneySummary({ net: sale.net_price_cents ?? null, payments: finance.payments, instalments: agreement.instalments }) : null;
  const step = finance && agreement ? nextStep({
    brand: sale.brand, status: sale.status, can: sale.permissions, hasNetPrice: sale.net_price_cents != null,
    hasSummary: finance.documents.some(doc => doc.kind === "summary"), hasBookingReceipt: finance.payments.some(payment => payment.kind === "booking"),
    isBookingDue: BigInt(finance.documents.findLast(doc => doc.kind === "summary")?.booking_cents ?? "0") > BigInt(0),
    hasDesignPlan: finance.design_plan != null, pendingPayments: pending,
    refundsToAct: refunds.filter(refund => refund.state === "pending" || refund.state === "approved").length,
    plotHeld: reservation?.active ?? false, isSettled: agreement.is_settled,
    quotations: { offered: quotations.filter(doc => doc.state === "offered").length, accepted: quotations.filter(doc => doc.state === "accepted").length },
    contract: contract ? contract.state === "signed" ? "signed" : "awaiting" : "none",
    instalment: row ? { label: row.label, needsAcceptance: row.needs_acceptance, accepted: row.accepted_at != null,
      hasInvoice: row.invoice_id != null, outstanding: row.balance?.outstanding_cents !== "0", isCreditCovered: row.net_cents === "0" } : null,
  }) : null;
  return { work, finance, agreement, closeout, reservation, refunds, pending, summary, step };
}
