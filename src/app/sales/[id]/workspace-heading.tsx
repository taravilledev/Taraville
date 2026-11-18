import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./workspace-section.module.css";

export function WorkspaceHeading({ caseId, title, titleId, description, children }: {
  caseId: string; title: string; titleId?: string; description: string; children?: ReactNode;
}) {
  return <header className={styles.header}>
    <div><h2 id={titleId}>{title}</h2><p>{description}</p></div>
    <div className={styles.actions}>{children}<Link href={`/sales/${caseId}?tab=documents`} prefetch={false}>เอกสารทั้งหมด →</Link></div>
  </header>;
}
