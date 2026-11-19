import Link from "next/link";
import type { ReactNode } from "react";
import * as ws from "./workspace-styles";

export function WorkspaceHeading({ caseId, title, titleId, description, children }: {
  caseId: string; title: string; titleId?: string; description: string; children?: ReactNode;
}) {
  return <header className={ws.header}>
    <div><h2 id={titleId}>{title}</h2><p>{description}</p></div>
    <div className={ws.actions}>{children}<Link href={`/sales/${caseId}?tab=documents`} prefetch={false}>เอกสารทั้งหมด →</Link></div>
  </header>;
}
