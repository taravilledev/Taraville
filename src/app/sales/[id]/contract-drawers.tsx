import Link from "next/link";
import { taskHref, type Task } from "@/lib/sales/tasks";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { SalesCase } from "@/lib/sales/models";
import { SignContractTask, UnlockContractTask } from "./tasks/document-tasks";
import { Drawer } from "@/components/drawer";
import { buttonVariants } from "@/components/ui/button";

/** One contract task as a control: sign and unlock are short forms in a drawer (`?drawer=sign-<id>` / `unlock-<id>` opens it on load),
 * the rest open their full page. */
export function ContractTaskAction({ task, sale, agreement, label, isPrimary = false }: {
  task: Task; sale: SalesCase; agreement: AgreementDetail; label: string; isPrimary?: boolean;
}) {
  const className = buttonVariants({ variant: isPrimary ? "default" : "outline", size: "auto" });
  if (task.row && (task.name === "sign-contract" || task.name === "unlock-contract")) {
    const View = task.name === "sign-contract" ? SignContractTask : UnlockContractTask;
    return <Drawer name={`${task.name === "sign-contract" ? "sign" : "unlock"}-${task.row}`} title={label}
      trigger={<button type="button" className={className}>{label}</button>}>
      <View sale={sale} agreement={agreement} row={task.row} key={`${sale.version}:${task.row}`} />
    </Drawer>;
  }
  return <Link className={className} href={taskHref(sale.id, task.name, task.row)} prefetch={false}>{label}</Link>;
}
