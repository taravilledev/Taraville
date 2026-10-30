import { randomUUID } from "node:crypto";
import type { Lead } from "@/lib/walkin/models";
import { privacyNotice, surveyChoice, type PrivacyEvent } from "@/lib/walkin/privacy";
import { ActionForm } from "./action-form";
import { recordPrivacy } from "./privacy-actions";
import { VersionedNotice } from "./versioned-notice";
import styles from "./walkin.module.css";

export const formatDate = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
const mutation = (lead: Lead, operation: "contact" | "opt_in" | "withdraw") =>
  recordPrivacy.bind(null, { id: lead.id, version: lead.version, requestId: randomUUID(), operation });

export function ContactRecord({ lead }: { lead: Lead }) {
  return <section className={styles.card}>
    <details><summary>บันทึกว่าติดต่อลูกค้าแล้ว</summary>
      <ActionForm action={mutation(lead, "contact")} label="ยืนยันบันทึกการติดต่อ">
        <input type="hidden" name="confirm_operation" value="on" />
        <p className={styles.hint}>ระบบใช้เวลาที่กดยืนยันเป็นวันที่ติดต่อล่าสุด ย้อนกลับไม่ได้</p>
      </ActionForm>
    </details>
  </section>;
}

export function SurveyChoice({ lead, events, canEdit }: { lead: Lead; events: PrivacyEvent[]; canEdit: boolean }) {
  const choice = surveyChoice(events);
  const notice = privacyNotice(lead.privacy_mode);
  return <section className={styles.card}><h2>ตัวเลือกแบบสอบถามเพิ่มเติม</h2>
    <p>{choice === null ? "ยังไม่มีหลักฐานตัวเลือก" : choice ? "ลูกค้าเลือกให้ข้อมูลเพิ่มเติม" : "ลูกค้าไม่ให้ข้อมูลเพิ่มเติม"}</p>
    {canEdit && choice !== true && <details><summary>เลือกให้ข้อมูลแบบสอบถามเพิ่มเติม</summary>
      <VersionedNotice brand={lead.brand} mode={lead.privacy_mode} />
      <ActionForm action={mutation(lead, "opt_in")} label="ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม">
        <label className={styles.option}><input type="checkbox" name="notice_presented" required /><span>{notice.choices.notice_presented}</span></label>
        <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>{notice.choices.survey_consent}</span></label>
      </ActionForm>
    </details>}
    {canEdit && choice !== false && <details><summary>ถอนหรือไม่ให้ข้อมูลแบบสอบถามเพิ่มเติม</summary>
      <ActionForm action={mutation(lead, "withdraw")} label="ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม">
        <p>จะล้างคำตอบแบบสอบถามเพิ่มเติมรวมที่อยู่ คงข้อมูลติดต่อ ผู้ดูแล และประวัติหลักฐานไว้</p>
        <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันการถอนตัวเลือกและล้างคำตอบเพิ่มเติม</span></label>
      </ActionForm>
    </details>}
  </section>;
}

export function EvidenceHistory({ events }: { events: PrivacyEvent[] }) {
  return <section className={styles.card}>
    <details><summary>ประวัติหลักฐาน ({events.length})</summary>
      <p className={styles.hint}>เวลาเป็นเวลาที่ระบบบันทึก ไม่ใช่หลักฐานเวลาที่อ่านประกาศจริง</p>
      {!events.length && <p>รายการเดิมไม่มีหลักฐานย้อนหลัง</p>}
      <ol>{events.map(event => <li key={event.id}>
        {event.kind === "initial" ? "สร้างรายการพร้อมคำขอติดต่อกลับ" : event.kind === "contact" ? "บันทึกการติดต่อ" : "เปลี่ยนตัวเลือกแบบสอบถาม"}
        {event.kind !== "contact" && ` · ${event.survey_consent ? "ให้ข้อมูลเพิ่มเติม" : "ไม่ให้ข้อมูลเพิ่มเติม"}`}
        <br />{formatDate(event.recorded_at)} · ฉบับ {event.notice_version}
        <br />รหัสหลักฐาน: <span style={{ overflowWrap: "anywhere" }}>{event.notice_hash}</span>
      </li>)}</ol>
    </details>
  </section>;
}
