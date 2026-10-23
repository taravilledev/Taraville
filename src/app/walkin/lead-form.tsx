import type { Lead, Staff } from "@/lib/walkin/models";
import { SURVEY_QUESTIONS, type Brand } from "@/lib/walkin/survey-questions";
import { SurveyField } from "./survey-field";
import { ActionForm } from "./action-form";
import { saveLead } from "./actions";
import { ConsentFields } from "./consent-fields";
import { NoticeDialog } from "./notice-dialog";
import { RequiredMark } from "./required-mark";
import { VersionedNotice } from "./versioned-notice";
import styles from "./walkin.module.css";

export const LEAD_FORM_ID = "lead-form";

export function LeadForm({ brand, staff, owners, lead, requestId, choice = null }: {
  brand: Brand; staff: Staff; owners: Staff[]; lead?: Lead; requestId: string; choice?: boolean | null;
}) {
  const questions = SURVEY_QUESTIONS[brand];
  const context = { brand, requestId, ...(lead ? { id: lead.id, version: lead.version } : {}) };
  const isSurveyShown = lead ? choice !== false : true;
  return <>
    {!lead && <NoticeDialog><VersionedNotice brand={brand} /></NoticeDialog>}
    <ActionForm id={LEAD_FORM_ID} sticky action={saveLead.bind(null, context)}>
      <section id="contact" className={styles.card} aria-labelledby="contact-title">
        <div className={styles.sectionHeading}><h2 id="contact-title">ข้อมูลติดต่อ</h2><span>ช่องที่มี<RequiredMark />เป็นข้อมูลจำเป็น</span></div>
        <div className={styles.nameGrid}>
          <label className={styles.field}>คำนำหน้า<select name="name_title" defaultValue={lead?.name_title ?? ""} autoComplete="honorific-prefix">
            <option value="">ไม่ระบุ</option><option>นาย</option><option>นาง</option><option>นางสาว</option>
          </select></label>
          <label className={styles.field}><span>ชื่อ<RequiredMark /></span><input name="first_name" defaultValue={lead?.first_name} autoComplete="given-name" required maxLength={200} /></label>
          <label className={styles.field}>นามสกุล<input name="last_name" defaultValue={lead?.last_name} autoComplete="family-name" maxLength={200} /></label>
        </div>
        <div className={styles.contactGrid}>
          <label className={styles.field}><span>เบอร์โทรศัพท์มือถือ<RequiredMark /></span><input name="phone" type="tel" inputMode="tel" defaultValue={lead?.phone} autoComplete="tel" required maxLength={80} /></label>
          <label className={styles.field}>LINE ID<input name="line_id" defaultValue={lead?.line_id} autoComplete="off" maxLength={200} /></label>
        </div>
        {!lead && staff.role === "executive" ? <label className={styles.field}><span>ฝ่ายขายผู้ดูแล<RequiredMark /></span>
          <select name="owner_id" required defaultValue=""><option value="">เลือกฝ่ายขาย</option>
            {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
          </select></label> : <input type="hidden" name="owner_id" value={lead?.owner_id ?? staff.id} />}
      </section>
      {isSurveyShown ? <section id="survey" className={styles.card} aria-labelledby="survey-title">
        <h2 id="survey-title">แบบสอบถามความต้องการ</h2><p className={styles.sectionHint}>ไม่บังคับ ข้อที่ลูกค้าไม่ตอบ เว้นว่างได้</p>
        <div className={styles.questions}>{questions.filter(question => question.key !== "sales_staff").map(question =>
          <SurveyField key={question.key} question={question} answers={lead?.survey} />)}</div>
      </section> : <p className={styles.hint} role="status">ลูกค้าไม่ให้ข้อมูลแบบสอบถามเพิ่มเติม · เปลี่ยนตัวเลือกได้จากหน้ารายละเอียด</p>}
      {!lead && <ConsentFields />}
    </ActionForm>
  </>;
}
