import { Suspense } from "react";
import Link from "next/link";
import { leadWork } from "@/lib/sales/lead-work";
import { leadDetail, leadProjects } from "@/lib/walkin/queries";
import { staffSchema } from "@/lib/walkin/models";
import { SURVEY_QUESTIONS } from "@/lib/walkin/survey-questions";
import { COMPANIES } from "@/lib/walkin/companies";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { ContactRecord, formatDate } from "@/app/walkin/privacy-controls";
import { CustomerWork } from "./customer-work";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "รายละเอียดผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };
export default function LeadPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Detail {...props} /></Suspense>;
}
async function Detail({ params, searchParams }: Props) {
  const { id } = await params;
  const session = await leadDetail(id);
  const { lead, staff } = session;
  const canEdit = staff.role === "executive" || lead.owner_id === staff.id;
  const [work, { projects, names }] = await Promise.all([leadWork(session.supabase, lead.id), leadProjects(session)]);
  const saved = (await searchParams).saved === "1";
  const ownerResult = await session.supabase.from("staff").select("id,full_name,role,is_active").eq("id", lead.owner_id).maybeSingle();
  if (ownerResult.error) throw new Error("โหลดผู้ดูแลไม่ได้ กรุณาลองใหม่");
  const owner = staffSchema.nullable().parse(ownerResult.data);
  const currentOwner = owner ? `${owner.full_name}${owner.is_active ? "" : " (ปิดใช้งาน)"}` : "ผู้ดูแลเดิม";
  return <AppShell staff={staff}>
    {saved && <p className={styles.banner} role="status"><span>บันทึกแล้ว</span><a href="/walkin">รับลูกค้ารายถัดไป</a></p>}
    <section className={styles.card}>
      <p className={styles.pills}><span className={`${styles.pill} ${lead.brand === "TARAVILLE" ? styles.pillTv : styles.pillBk}`}>{COMPANIES[lead.brand].brandName}</span>
        {lead.privacy_mode === "synthetic" && <span className={styles.pill}>ข้อมูลสมมติสำหรับทดสอบ</span>}</p>
      <h1>{lead.name_title} {lead.first_name} {lead.last_name}</h1>
      <dl className={styles.details}><dt>เบอร์โทร</dt><dd>{lead.phone}</dd><dt>LINE ID</dt><dd>{lead.line_id || "ไม่ได้ระบุ"}</dd>
        <dt>ผู้ดูแล</dt><dd>{currentOwner}</dd><dt>บันทึกเมื่อ</dt><dd>{formatDate(lead.created_at)}</dd>
        <dt>ติดต่อล่าสุด</dt><dd>{lead.last_contact_at ? formatDate(lead.last_contact_at) : "ยังไม่มีวันที่ติดต่อ"}</dd></dl>
      <div className={styles.actions}>
        <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className={styles.primaryLink}>โทร</a>
        {canEdit && <a href={`/leads/${lead.id}/edit`} className={styles.secondaryLink}>แก้ไขข้อมูล</a>}
      </div>
      {!canEdit && <p className={styles.hint}>ดูข้อมูลได้ · แก้ไขได้เฉพาะผู้ดูแลรายการและผู้บริหาร</p>}
    </section>
    <CustomerWork lead={lead} projects={projects} names={names} work={work} canEdit={canEdit} />
    {canEdit && <ContactRecord lead={lead} />}
    <section className={styles.card}><h2>คำตอบแบบสอบถาม</h2><dl className={`${styles.answers} ${styles.answersGrid}`}>
      {SURVEY_QUESTIONS[lead.brand].filter(question => !question.legacy || lead.survey[question.key]).map(question => {
        const value = lead.survey[question.key];
        const answer = Array.isArray(value) ? value.join(" · ") : value;
        return <div key={question.key}><dt>{question.label}</dt><dd>{answer || "ไม่ได้ระบุ"}
          {lead.survey[`${question.key}_other`] && <span> · {lead.survey[`${question.key}_other`]}</span>}</dd></div>;
      })}</dl></section>
    <p className={styles.actions}><Link href={`/leads/${lead.id}/manage`} prefetch={false} className={styles.secondaryLink}>จัดการ Lead</Link>
      <Link href={`/leads/${lead.id}/history`} prefetch={false} className={styles.secondaryLink}>ประวัติหลักฐาน</Link></p>
  </AppShell>;
}
