import { Suspense } from "react";
import { closeInfo, leadDetail, saleOwners } from "@/lib/walkin/queries";
import { staffSchema } from "@/lib/walkin/models";
import { SURVEY_QUESTIONS } from "@/lib/walkin/survey-questions";
import { COMPANIES } from "@/lib/walkin/companies";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { RequiredMark } from "@/app/walkin/required-mark";
import { ActionForm } from "@/app/walkin/action-form";
import { reassignLead } from "@/app/walkin/actions";
import { LeadStatus } from "@/app/walkin/status-controls";
import { ContactRecord, EvidenceHistory, SurveyChoice, formatDate } from "@/app/walkin/privacy-controls";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "รายละเอียดผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };
export default function LeadPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Detail {...props} /></Suspense>;
}
async function Detail({ params, searchParams }: Props) {
  const { id } = await params;
  const session = await leadDetail(id);
  const { lead, staff, events } = session;
  const [owners, closed] = await Promise.all([saleOwners(session), closeInfo(session)]);
  const saved = (await searchParams).saved === "1";
  const ownerResult = await session.supabase.from("staff").select("id,full_name,role,is_active").eq("id", lead.owner_id).maybeSingle();
  if (ownerResult.error) throw new Error("โหลดผู้ดูแลไม่ได้ กรุณาลองใหม่");
  const owner = staffSchema.nullable().parse(ownerResult.data);
  const currentOwner = owner ? `${owner.full_name}${owner.is_active ? "" : " (ปิดใช้งาน)"}` : "ผู้ดูแลเดิม";
  return <AppShell staff={staff}>
    {saved && <p className={styles.banner} role="status"><span>บันทึกแล้ว</span><a href="/walkin">รับลูกค้ารายถัดไป</a></p>}
    <section className={styles.card}>
      <p className={styles.eyebrow}>{COMPANIES[lead.brand].brandName}{lead.privacy_mode === "synthetic" ? " · ข้อมูลสมมติสำหรับทดสอบ" : ""}</p>
      <h1>{lead.name_title} {lead.first_name} {lead.last_name}</h1>
      <dl className={styles.details}><dt>เบอร์โทร</dt><dd>{lead.phone}</dd><dt>LINE ID</dt><dd>{lead.line_id || "ไม่ได้ระบุ"}</dd>
        <dt>ผู้ดูแล</dt><dd>{currentOwner}</dd><dt>บันทึกเมื่อ</dt><dd>{formatDate(lead.created_at)}</dd>
        <dt>ติดต่อล่าสุด</dt><dd>{lead.last_contact_at ? formatDate(lead.last_contact_at) : "ยังไม่มีวันที่ติดต่อ"}</dd></dl>
      <div className={styles.actions}>
        <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className={styles.primaryLink}>โทร</a>
        <a href={`/leads/${lead.id}/edit`} className={styles.secondaryLink}>แก้ไขข้อมูล</a>
      </div>
    </section>
    <LeadStatus lead={lead} info={closed} />
    <ContactRecord lead={lead} />
    <section className={styles.card}><h2>คำตอบแบบสอบถาม</h2><dl className={styles.answers}>
      {SURVEY_QUESTIONS[lead.brand].map(question => {
        const value = lead.survey[question.key];
        const answer = Array.isArray(value) ? value.join(" · ") : value;
        return <div key={question.key}><dt>{question.label}</dt><dd>{answer || "ไม่ได้ระบุ"}
          {lead.survey[`${question.key}_other`] && <span> · {lead.survey[`${question.key}_other`]}</span>}</dd></div>;
      })}</dl></section>
    <SurveyChoice lead={lead} events={events} />
    {staff.role === "executive" && <section className={styles.card}><h2>เปลี่ยนฝ่ายขายผู้ดูแล</h2>
      <ActionForm action={reassignLead.bind(null, lead.id, lead.version)} label="เปลี่ยนผู้ดูแล">
        <label className={styles.field}><span>ฝ่ายขายผู้ดูแล<RequiredMark /></span><select name="owner_id" defaultValue={owners.some(owner => owner.id === lead.owner_id) ? lead.owner_id : ""} required>
          <option value="">เลือกฝ่ายขาย</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
        </select></label>
        <p className={styles.hint}>ผู้ดูแลคนใหม่จะเห็นรายการนี้ ส่วนผู้ดูแลเดิมจะไม่เห็นอีก</p>
      </ActionForm>
    </section>}
    <EvidenceHistory events={events} />
  </AppShell>;
}
