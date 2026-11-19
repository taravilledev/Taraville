import type { SalesCase } from "./models";
import type { FinancialDetail } from "./financial-models";
import type { AgreementDetail } from "./agreement-models";
import type { Refund } from "./refund-models";
import type { TaskContext } from "./tasks";

type Source = {
  sale: SalesCase; finance: FinancialDetail | null; agreement: AgreementDetail | null; refunds: Refund[]; staffId: string;
  reservation: { active: boolean; options: { id: string }[] } | null; work: { id: string; accepted: boolean }[];
};

/** Reduces what the case page loaded to the plain facts the task registry decides on. */
export function taskContext({ sale, finance, agreement, refunds, staffId, reservation, work }: Source): TaskContext {
  const rows = (agreement?.instalments ?? []).filter(row => row.is_active);
  return {
    brand: sale.brand, status: sale.status, can: { ...sale.permissions, "financial.view": sale.can_finance },
    canAssign: sale.can_assign, hasNetPrice: sale.net_price_cents != null,
    design: { canChange: finance?.can_change_design ?? false, amounts: finance?.design_plan?.instalments,
      legacyReceived: finance?.design_legacy_received_cents,
      legacyLocked: finance?.design_legacy_has_payments || finance?.pending.some(payment => payment.kind === "design_fee" && !finance.design_bills.some(bill => bill.pending_id === payment.id)),
      bills: finance?.design_bills.map(bill => ({ id: bill.id, position: bill.position, state: bill.state, pendingId: bill.pending_id, received: bill.received_cents, hasConfirmed: bill.has_confirmed_payment })) },
    summaryCount: finance?.documents.filter(doc => doc.kind === "summary").length ?? 0,
    hasPayments: (finance?.payments.length ?? 0) > 0, plotHeld: reservation?.active ?? false, unitOptions: reservation?.options.length ?? 0,
    pendingPaymentIds: finance?.pending.map(payment => payment.id) ?? [],
    receipts: finance?.documents.filter(doc => doc.kind === "receipt").map(doc => ({ id: doc.id, state: doc.state })) ?? [],
    quotations: agreement?.documents.filter(doc => doc.kind === "quotation").map(doc => ({
      id: doc.id, state: doc.state, hasPrice: BigInt(doc.payload.total_cents ?? "0") > BigInt(0) && doc.payload.price_set !== false,
    })) ?? [],
    contracts: agreement?.documents.filter(doc => doc.kind === "contract").map(doc => ({
      id: doc.id, state: doc.state, hasSeparateDesignFee: doc.payload.design_fee_separate === true,
    })) ?? [],
    instalments: rows.map(row => ({ id: row.id, needsAcceptance: row.needs_acceptance, accepted: row.accepted_at != null, hasInvoice: row.invoice_id != null,
      canReceive: row.balance?.is_active === true && row.balance.outstanding_cents !== "0" })),
    workAcceptance: work, refunds: refunds.map(refund => ({ id: refund.id, state: refund.state, isMine: refund.requested_by === staffId })),
  };
}
