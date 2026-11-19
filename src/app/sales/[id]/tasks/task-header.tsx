import Link from "next/link";
import type { ReactNode } from "react";
import type { SalesCase } from "@/lib/sales/models";
import type { CaseTab } from "@/lib/sales/case-progress";
import type { TaskName } from "@/lib/sales/tasks";
import * as styles from "./task-header-styles";
import { buttonVariants } from "@/components/ui/button";

export const focusedDocumentTasks: readonly TaskName[] = ["contract-addendum", "issue-quotation", "prepare-contract", "edit-contract",
  "lock-contract", "unlock-contract", "sign-contract", "acceptance", "issue-invoice", "prepare-instalment", "prepare-payment",
  "issue-design-invoice", "prepare-design-payment", "confirm-payment"];

export function usesFocusedTaskHeader(name: TaskName, isBkp: boolean) {
  return focusedDocumentTasks.includes(name) || (isBkp && name !== "accept-quotation");
}

export function TaskHeader({ sale, title, backTab, backLabel, phase, status }: {
  sale: Pick<SalesCase, "id" | "code" | "customer_name">; title: string; backTab: CaseTab; backLabel: string;
  phase?: string; status?: ReactNode;
}) {
  return <header className={styles.header}>
    <nav className={styles.navigation} aria-label="การนำทางงาน">
      <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}?tab=${backTab}`} prefetch={false}><span aria-hidden="true">←</span> {backLabel}</Link>
      <Link className={styles.overview} href={`/sales/${sale.id}?tab=overview`} prefetch={false}>ภาพรวมโครงการ</Link>
    </nav>
    <div className={styles.heading}>{phase && <p className={styles.phase}>{phase}</p>}
      <h1>{title}</h1><p className={styles.context}>{sale.code} · {sale.customer_name}</p>
    </div>
    {status && <div className={styles.status}>{status}</div>}
  </header>;
}
