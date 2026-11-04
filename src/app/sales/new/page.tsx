import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { salesBootstrap } from "@/lib/sales/queries";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { NewCaseForm } from "./new-case-form";
import styles from "../sales.module.css";

export const metadata = { title: "เปิดงาน/รายการขาย · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function NewCasePage(props: Props) { return <Suspense fallback={<PageSkeleton />}><NewCase {...props} /></Suspense>; }
async function NewCase({ searchParams }: Props) {
  const { staff, workspace } = await salesBootstrap();
  const raw = await searchParams;
  const initialLead = typeof raw.lead === "string" ? raw.lead : "";
  const needsProject = workspace.leads.filter(lead => lead.brand === "BAAN_KUNAPAP" && !lead.project_id);
  return <AppShell staff={staff}><div className={styles.page}>
    <div className={styles.header}><h1>เปิดงาน/รายการขาย</h1><Link className={styles.link} href="/sales" prefetch={false}>กลับรายการงาน</Link></div>
    <section className={styles.panel}>
      {workspace.leads.length ? <NewCaseForm workspace={workspace} initialLead={initialLead} requestId={randomUUID()} />
        : <p>ไม่มี Lead ที่คุณมีสิทธิ์เปิดงาน <Link href="/leads" prefetch={false}>ไปที่รายการ Lead</Link></p>}
    </section>
    {needsProject.length > 0 && <section className={styles.panel}><h2>บ้านคุณภาพที่ยังไม่เปิดโครงการ</h2><p>เปิดโครงการจากหน้า Lead ก่อน แล้วกลับมาเปิดงานนี้</p><ul>{needsProject.map(lead => <li key={lead.id}><Link href={`/leads/${lead.id}`} prefetch={false}>{lead.full_name}</Link></li>)}</ul></section>}
  </div></AppShell>;
}
