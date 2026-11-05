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

export const metadata = { title: "เปิดรายการขาย · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function NewCasePage(props: Props) { return <Suspense fallback={<PageSkeleton />}><NewCase {...props} /></Suspense>; }

/** A sale starts from a Lead: the Lead comes from the query, is checked here, and travels to the form as a hidden input. */
async function NewCase({ searchParams }: Props) {
  const { staff, workspace, supabase } = await salesBootstrap();
  const raw = (await searchParams).lead;
  const leadId = z.uuid().safeParse(raw).success ? String(raw) : null;
  const lead = leadId ? workspace.leads.find(item => item.id === leadId) : undefined;
  const work = lead ? await leadWork(supabase, lead.id) : null;
  const reason = !lead ? "เปิดรายการขายได้จากหน้า Lead เท่านั้น ไม่พบ Lead นี้หรือคุณไม่มีสิทธิ์เปิดรายการขาย"
    : !work ? "โหลดข้อมูลงานของ Lead ไม่ได้ ลองใหม่อีกครั้ง"
    : !work.canCreate ? "Lead นี้เปิดรายการขายใหม่ไม่ได้ในขณะนี้ (Lead ปิดอยู่ ไม่มีโครงการที่ใช้งานอยู่ หรือโครงการนี้เคยมีรายการขายแล้ว)" : null;
  return <AppShell staff={staff}><div className={styles.page}>
    <div className={styles.header}><h1>เปิดรายการขาย</h1><Link className={styles.link} href={lead ? `/leads/${lead.id}` : "/leads"} prefetch={false}>กลับหน้า Lead</Link></div>
    <section className={styles.panel}>
      {reason || !lead ? <p role="alert">{reason}</p>
        : <NewCaseForm workspace={workspace} lead={lead} requestId={randomUUID()} />}
    </section>
  </div></AppShell>;
}
