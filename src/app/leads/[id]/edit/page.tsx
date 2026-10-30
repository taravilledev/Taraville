import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { leadDetail } from "@/lib/walkin/queries";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { FormHeader } from "@/app/walkin/form-header";
import { LeadForm } from "@/app/walkin/lead-form";
import { surveyChoice } from "@/lib/walkin/privacy";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "แก้ไขผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<PageSkeleton />}><Edit params={params} /></Suspense>;
}
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { lead, staff, events } = await leadDetail((await params).id);
  if (staff.role !== "executive" && lead.owner_id !== staff.id) notFound();
  return <AppShell staff={staff}>
    <FormHeader brand={lead.brand} title="แก้ไขข้อมูล" action={<a className={styles.noticeLink} href={`/leads/${lead.id}`}>← กลับไปรายละเอียด</a>} />
    <LeadForm brand={lead.brand} staff={staff} owners={[]} lead={lead} choice={surveyChoice(events)} requestId={randomUUID()} />
  </AppShell>;
}
