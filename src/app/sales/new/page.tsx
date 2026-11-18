import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { z } from "zod";
import { salesBootstrap } from "@/lib/sales/queries";
import { leadWork } from "@/lib/sales/lead-work";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { NewCaseForm } from "./new-case-form";
import styles from "../sales.module.css";

export const metadata = { title: "เปิดโครงการ · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function NewCasePage(props: Props) { return <Suspense fallback={<PageSkeleton />}><NewCase {...props} /></Suspense>; }

/** A sale starts from a Lead: the Lead comes from the query, is checked here, and travels to the form as a hidden input. */
async function NewCase({ searchParams }: Props) {
  const { staff, workspace, supabase } = await salesBootstrap();
  const query = await searchParams;
  const raw = query.lead;
  const leadId = z.uuid().safeParse(raw).success ? String(raw) : null;
  const lead = leadId ? workspace.leads.find(item => item.id === leadId) : undefined;
  const work = lead ? await leadWork(supabase, lead.id) : null;
  const projects = workspace.leads.flatMap(item => item.id === leadId && item.project_id && item.project_code && !work?.cases.some(sale => sale.project_id === item.project_id)
    ? [{ id: item.project_id, code: item.project_code }] : []).sort((a, b) => a.code.localeCompare(b.code));
  const selectedProject = query.project ? projects.find(item => item.id === query.project) : projects.length === 1 ? projects[0] : undefined;
  const reason = !lead ? "เปิดโครงการได้จากหน้า Lead เท่านั้น ไม่พบ Lead นี้หรือคุณไม่มีสิทธิ์เปิดโครงการ"
    : !work ? "โหลดข้อมูลงานของ Lead ไม่ได้ ลองใหม่อีกครั้ง"
    : !work.canCreate ? "Lead นี้เปิดโครงการไม่ได้ในขณะนี้ (Lead ปิดอยู่ หรือไม่สามารถเริ่มดำเนินโครงการใหม่ได้)"
    : query.project && !selectedProject ? "ไม่พบโครงการที่เปิดจาก Lead นี้ได้ กรุณาเลือกโครงการจากหน้า Lead อีกครั้ง" : null;
  return <AppShell staff={staff}><div className={styles.page}>
    <div className={styles.header}><h1>เปิดโครงการ</h1><Link className={styles.link} href={lead ? `/leads/${lead.id}` : "/leads"} prefetch={false}>กลับหน้า Lead</Link></div>
    <section className={styles.panel}>
      {reason || !lead ? <p role="alert">{reason}</p>
        : <NewCaseForm workspace={workspace} lead={lead} projects={projects} projectId={selectedProject?.id ?? ""} requestId={randomUUID()} />}
    </section>
  </div></AppShell>;
}
