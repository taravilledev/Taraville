import type { Lead, Staff } from "@/lib/walkin/models";
import { SURVEY_QUESTIONS, type Brand } from "@/lib/walkin/survey-questions";
import { SurveyField } from "./survey-field";
import { ActionForm } from "./action-form";
import { saveLead } from "./actions";
import { CompanyNotice } from "./company-notice";
import { PrivacyFields } from "./privacy-fields";
import { VersionedNotice } from "./versioned-notice";
import styles from "./walkin.module.css";

export function SyntheticConfirmation() {
  return <label className={styles.option}><input type="checkbox" name="synthetic_only" required />
    <span>ยืนยันว่าเป็นข้อมูลสมมติสำหรับทดสอบระบบ ไม่ใช่ข้อมูลลูกค้าจริง</span></label>;
}

export function LeadForm({ brand, staff, owners, lead, requestId, choice = null }: {
  brand: Brand; staff: Staff; owners: Staff[]; lead?: Lead; requestId: string; choice?: boolean | null;
}) {
  const questions = SURVEY_QUESTIONS[brand];
  const context = { brand, requestId, ...(lead ? { id: lead.id, version: lead.version } : {}) };
  return <><CompanyNotice brand={brand} /><ActionForm action={saveLead.bind(null, context)}>
    <PrivacyFields isNew={!lead} choice={choice} notice={<VersionedNotice brand={brand} />} contact={
    <section id="contact" className={styles.card} aria-labelledby="contact-title">
      <div className={styles.sectionHeading}><h2 id="contact-title">ข้อมูลติดต่อ</h2><span>ช่องที่มี * เป็นข้อมูลจำเป็น</span></div>
      <div className={styles.nameGrid}>
        <label className={styles.field}>คำนำหน้า<select name="name_title" defaultValue={lead?.name_title ?? ""} autoComplete="honorific-prefix">
          <option value="">ไม่ระบุ</option><option>นาย</option><option>นาง</option><option>นางสาว</option>
        </select></label>
        <label className={styles.field}>ชื่อ *<input name="first_name" defaultValue={lead?.first_name} autoComplete="given-name" required maxLength={200} /></label>
        <label className={styles.field}>นามสกุล<input name="last_name" defaultValue={lead?.last_name} autoComplete="family-name" maxLength={200} /></label>
      </div>
      <div className={styles.contactGrid}>
        <label className={styles.field}>เบอร์โทรศัพท์มือถือ *<input name="phone" type="tel" inputMode="tel" defaultValue={lead?.phone} autoComplete="tel" required maxLength={80} /></label>
        <label className={styles.field}>LINE ID<input name="line_id" defaultValue={lead?.line_id} autoComplete="off" maxLength={200} /></label>
      </div>
      {!lead && staff.role === "executive" ? <label className={styles.field}>ฝ่ายขายผู้ดูแล *
        <select name="owner_id" required defaultValue=""><option value="">เลือกฝ่ายขาย</option>
          {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
        </select></label> : <input type="hidden" name="owner_id" value={lead?.owner_id ?? staff.id} />}
      <p className={styles.ownerNote}>ฝ่ายขายผู้ดูแลอ้างอิงบัญชีพนักงาน ส่วนชื่อผู้บันทึกใช้บัญชีที่เข้าสู่ระบบ</p>
    </section>} survey={
    <section id="survey" className={styles.card} aria-labelledby="survey-title">
      <h2 id="survey-title">แบบสอบถามความต้องการ</h2><p className={styles.sectionHint}>คำถามเพิ่มเติมเลือกไม่ตอบได้</p>
      <div className={styles.questions}>{questions.filter(question => question.key !== "sales_staff").map(question =>
        <SurveyField key={question.key} question={question} answers={lead?.survey} />)}</div>
    </section>} />
    <p className={styles.ownerNote}>ผู้บันทึก: <strong>{staff.full_name}</strong> · ใช้ชื่อจากบัญชีที่เข้าสู่ระบบโดยอัตโนมัติเมื่อบันทึก</p>
    <section className={styles.card} id="privacy"><h2>ก่อนบันทึก</h2>
      <p className={styles.pendingPrivacy}>บันทึกเฉพาะการจำลองขั้นตอนและตัวเลือก ยังไม่เปิดรับข้อมูลหรือความยินยอมจากลูกค้าจริง</p>
      <a className={styles.noticeLink} href={`/privacy?brand=${brand}`} target="_blank" rel="noopener noreferrer">อ่านร่างประกาศความเป็นส่วนตัว (เปิดแท็บใหม่)</a>
      <SyntheticConfirmation />
    </section>
  </ActionForm></>;
}
