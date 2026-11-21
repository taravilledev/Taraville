import { bkpWorkflow } from "@/lib/sales/bkp-workflow";
import { nextDesignPayment } from "@/lib/sales/design-fees";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import type { AgreementDetail } from "@/lib/sales/agreement-models";

/** Note under the "ออกแบบ" stage: paid design-fee instalments, same net received total that marks the fee stage done. */
export function designFeeNote(finance: FinancialDetail, agreement: AgreementDetail): string {
  if (!finance.design_plan) return "ยังไม่กำหนดแพ็กเกจ";
  const instalments = finance.design_plan.instalments;
  const count = instalments.filter(amount => amount !== "0").length;
  const next = nextDesignPayment(instalments, bkpWorkflow(finance, agreement).received);
  const paid = next ? instalments.slice(0, next.position - 1).filter(amount => amount !== "0").length : count;
  return `ค่าแบบ ${paid}/${count} งวด`;
}
