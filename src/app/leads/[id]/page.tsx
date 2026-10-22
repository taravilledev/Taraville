import { Suspense } from "react";
import { leadDetail, saleOwners } from "@/lib/walkin/queries";
import { staffSchema } from "@/lib/walkin/models";
import { SURVEY_QUESTIONS } from "@/lib/walkin/survey-questions";
import { AppShell } from "@/app/walkin/app-shell";
import { ActionForm } from "@/app/walkin/action-form";
import { SyntheticConfirmation } from "@/app/walkin/lead-form";
import { reassignLead } from "@/app/walkin/actions";
import { PrivacyControls } from "@/app/walkin/privacy-controls";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "รายละเอียดผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };
export default function LeadPage(props: Props) {
  return <Suspense fallback={<p>กำลังโหลดรายการ…</p>}><Detail {...props} /></Suspense>;
}
async function Detail({ params, searchParams }: Props) {
  const { id } = await params;
  const session = await leadDetail(id);
  const { lead, staff, events } = session;
  const owners = await saleOwners(session);
  const saved = (await searchParams).saved === "1";
  const ownerResult = await session.supabase.from("staff").select("id,full_name,role,is_active").eq("id", lead.owner_id).maybeSingle();
  if (ownerResult.error) throw new Error("โหลดผู้ดูแลไม่ได้ กรุณาลองใหม่");
  const owner = staffSchema.nullable().parse(ownerResult.data);
  const currentOwner = owner ? `${owner.full_name}${owner.is_active ? "" : " (ปิดใช้งาน)"}` : "ผู้ดูแลเดิม";
  return <AppShell staff={staff}>
    {saved && <p role="status">บันทึกแล้ว กรุณาตรวจข้อมูลด้านล่าง</p>}
    <section className={styles.card}><p className={styles.eyebrow}>{lead.brand === "TARAVILLE" ? "TARAVILLE" : "BAAN KUNAPAP"}</p>
      <h1>{lead.name_title} {lead.first_name} {lead.last_name}</h1>
      <dl className={styles.details}><dt>เบอร์โทร</dt><dd>{lead.phone}</dd><dt>LINE ID</dt><dd>{lead.line_id || "ไม่ได้ระบุ"}</dd>
        <dt>ผู้ดูแล</dt><dd>{currentOwner}</dd><dt>บันทึกเมื่อ</dt><dd>{new Date(lead.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</dd></dl>
      <a href={`/leads/${lead.id}/edit`} className={styles.primaryLink}>แก้ไขข้อมูล</a>
    </section>
    <section className={styles.card}><h2>คำตอบแบบสอบถาม</h2><dl className={styles.answers}>
      {SURVEY_QUESTIONS[lead.brand].map(question => {
        const value = lead.survey[question.key];
        const answer = Array.isArray(value) ? value.join(" · ") : value;
        return <div key={question.key}><dt>{question.label}</dt><dd>{answer || "ไม่ได้ระบุ"}
          {lead.survey[`${question.key}_other`] && <span> · {lead.survey[`${question.key}_other`]}</span>}</dd></div>;
      })}</dl></section>
    <PrivacyControls lead={lead} events={events} />
    {staff.role === "executive" && <section className={styles.card}><h2>เปลี่ยนฝ่ายขายผู้ดูแล</h2>
      <p>การเปลี่ยนผู้ดูแลจะเปลี่ยนสิทธิ์การเข้าถึงรายการนี้ด้วย</p>
      <ActionForm action={reassignLead.bind(null, lead.id, lead.version)} label="ยืนยันเปลี่ยนผู้ดูแล">
        <label className={styles.field}>ฝ่ายขายผู้ดูแล *<select name="owner_id" defaultValue={owners.some(owner => owner.id === lead.owner_id) ? lead.owner_id : ""} required>
          <option value="">เลือกฝ่ายขาย</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
        </select></label><SyntheticConfirmation />
      </ActionForm>
    </section>}
  </AppShell>;
}
