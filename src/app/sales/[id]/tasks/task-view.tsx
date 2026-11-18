import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { taskReturnTab } from "@/lib/sales/case-navigation";
import { taskLabels, type Task, type TaskName } from "@/lib/sales/tasks";
import type { TaskData } from "./task-data";
import quotation from "./quotation-editor.module.css";
import { AssignTask, EditCaseTask, ReserveTask } from "./case-tasks";
import { AcceptQuotationTask, BookingSummaryTask, DesignTask, IssueQuotationTask, PrepareContractTask, SignContractTask, SignPropertyContractTask, LockContractTask, UnlockContractTask, ContractAddendumTask } from "./document-tasks";
import { AcceptanceTask, FixReceiptTask, IssueInvoiceTask, PrepareInstalmentTask, PreparePaymentTask, WithdrawPaymentTask } from "./money-tasks";
import { AmendTask, ChangeUnitTask, CloseTask, DecideRefundTask, PayRefundTask, ReleaseTask, RequestRefundTask } from "./exception-tasks";

import { IssueDesignInvoiceTask, PrepareDesignPaymentTask, CancelDesignInvoiceTask } from "./design-billing-tasks";
import { ConfirmPaymentTask } from "./confirm-payment-task";
import { usesFocusedTaskHeader, TaskHeader } from "./task-header";
import { panelClass } from "@/components/panel";

const views: Record<TaskName, ComponentType<TaskData>> = {
  "issue-design-invoice": IssueDesignInvoiceTask, "prepare-design-payment": PrepareDesignPaymentTask, "cancel-design-invoice": CancelDesignInvoiceTask,
  "edit-case": EditCaseTask, reserve: ReserveTask, assign: AssignTask,
  design: DesignTask, "issue-quotation": IssueQuotationTask, "accept-quotation": AcceptQuotationTask, "prepare-contract": PrepareContractTask,
  "contract-addendum": ContractAddendumTask,
  "edit-contract": PrepareContractTask, "lock-contract": LockContractTask, "unlock-contract": UnlockContractTask,
  "sign-contract": SignContractTask, "booking-summary": BookingSummaryTask, "sign-property-contract": SignPropertyContractTask,
  "prepare-payment": PreparePaymentTask, "prepare-instalment": PrepareInstalmentTask, "withdraw-payment": WithdrawPaymentTask,
  "confirm-payment": ConfirmPaymentTask,
  "fix-receipt": FixReceiptTask, "issue-invoice": IssueInvoiceTask, acceptance: AcceptanceTask,
  "change-unit": ChangeUnitTask, amend: AmendTask, close: CloseTask, release: ReleaseTask,
  "request-refund": RequestRefundTask, "decide-refund": DecideRefundTask, "pay-refund": PayRefundTask,
};

/** One task per view. The wrapper is keyed by the case version so a saved form never keeps old input under cacheComponents. */
export function TaskView({ task, data, context }: { task: Task; data: TaskData; context?: ReactNode }) {
  const View = views[task.name];
  const isBkp = data.sale.brand === "BAAN_KUNAPAP";
  const isDesignPayment = data.finance?.pending.some(payment => payment.id === task.row && payment.kind === "design_fee");
  const backTab = taskReturnTab(task.name, isBkp, isDesignPayment);
  const backLabels = { overview: data.sale.brand === "BAAN_KUNAPAP" ? "ภาพรวมโครงการ" : "หน้ารายการขาย", design: "ออกแบบ",
    quotation: "ใบเสนอราคา", contract: "สัญญา", documents: "เอกสาร", money: isBkp ? "การเงิน" : "รายการรับเงิน" };
  const visibleBackTab = backTab === "money" && !data.sale.can_finance ? "overview" : backTab;
  const isFocused = usesFocusedTaskHeader(task.name, isBkp);
  const ownsHeader = ["issue-quotation", "prepare-contract", "edit-contract"].includes(task.name);
  const hasPaperBody = ["issue-quotation", "prepare-contract", "edit-contract", "contract-addendum", "issue-invoice", "prepare-instalment",
    "prepare-payment", "issue-design-invoice", "prepare-design-payment", "confirm-payment"].includes(task.name);
  return <section className={isFocused ? quotation.task : panelClass}>
    {isFocused && !ownsHeader && <TaskHeader sale={data.sale} title={taskLabels[task.name]} backTab={visibleBackTab}
      backLabel={`กลับ${backLabels[visibleBackTab]}`} phase={backLabels[visibleBackTab]} />}
    {!isFocused && <>
      <p><Link href={`/sales/${data.sale.id}?tab=${visibleBackTab}`} prefetch={false}>← กลับ{backLabels[visibleBackTab]}</Link></p>
      <h2>{taskLabels[task.name]}</h2>
    </>}
    {context}
    <div className={isFocused && !hasPaperBody ? panelClass : undefined}
      key={`${data.sale.version}:${data.finance?.version ?? 0}:${task.name}:${task.row ?? ""}`}><View {...data} row={task.row} /></div>
  </section>;
}
