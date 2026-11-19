import type { SalesCase } from "@/lib/sales/models";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { Refund } from "@/lib/sales/refund-models";

/** What a task view receives. Finance reads are null for readers without financial access. */
export type TaskData = {
  sale: SalesCase; finance: FinancialDetail | null; agreement: AgreementDetail | null; staffId: string;
  reservation: { active: boolean; options: { id: string; label: string }[] } | null; refunds: Refund[];
  contractTemplate?: { contract_text: string; contract_text_approved?: boolean; contractor_name?: string; contractor_address?: string; is_synthetic?: boolean };
  owners: { id: string; full_name: string }[]; row?: string;
  work?: { id: string; requires_acceptance_date?: boolean }[];
};
export const idOf = (sale: SalesCase, id = sale.id, version = sale.version) => ({ id, version, requestId: crypto.randomUUID(),
  ...(sale.brand === "BAAN_KUNAPAP" && sale.can_finance ? { returnTab: "money" as const } : {}) });
