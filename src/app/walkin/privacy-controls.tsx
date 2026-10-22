import { randomUUID } from "node:crypto";
import type { Lead } from "@/lib/walkin/models";
import { privacyNotice, surveyChoice, type PrivacyEvent } from "@/lib/walkin/privacy";
import { ActionForm } from "./action-form";
import { DataConfirmation } from "./lead-form";
import { recordPrivacy } from "./privacy-actions";
import { VersionedNotice } from "./versioned-notice";
import styles from "./walkin.module.css";

const date = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
export function PrivacyControls({ lead, events }: { lead: Lead; events: PrivacyEvent[] }) {
  const choice = surveyChoice(events);
  const notice = privacyNotice(lead.privacy_mode);
  const context = { id: lead.id, version: lead.version };
  return <section className={styles.card}><h2>ตัวเลือกและการติดต่อ · {lead.privacy_mode === "synthetic" ? "ข้อมูลสมมติ" : "ผู้สนใจ"}</h2>
    <p>แบบสอบถาม: {choice === null ? "ยังไม่มีหลักฐานตัวเลือก" : choice ? "เลือกให้ข้อมูลเพิ่มเติม" : "ไม่ให้ข้อมูลเพิ่มเติม"}</p>
    <p>ติดต่อล่าสุด: {lead.last_contact_at ? date(lead.last_contact_at) : "ยังไม่มีวันที่ติดต่อ ไม่เติมจากประวัติเดิม"}</p>
    <p>การแก้ข้อมูลและเปลี่ยนผู้ดูแลไม่ต่ออายุวันที่ติดต่อ ทบทวนเมื่อครบ 12 เดือนหลังติดต่อล่าสุด</p>
    <details><summary>บันทึกการติดต่อครั้งใหม่</summary>
      <ActionForm action={recordPrivacy.bind(null, { ...context, requestId: randomUUID(), operation: "contact" })} label="ยืนยันบันทึกการติดต่อ">
        <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันว่ามีการติดต่อครั้งใหม่ตามประเภทข้อมูลของรายการนี้ ใช้เวลาที่ระบบบันทึกเป็นวันที่ติดต่อ</span></label>
        <DataConfirmation mode={lead.privacy_mode} />
      </ActionForm>
    </details>
    {choice !== true && <details><summary>เลือกให้ข้อมูลแบบสอบถามเพิ่มเติม</summary>
      <VersionedNotice brand={lead.brand} mode={lead.privacy_mode} />
      <ActionForm action={recordPrivacy.bind(null, { ...context, requestId: randomUUID(), operation: "opt_in" })} label="ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม">
        <label className={styles.option}><input type="checkbox" name="notice_presented" required /><span>{notice.choices.notice_presented}</span></label>
        <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>{notice.choices.survey_consent}</span></label>
        <DataConfirmation mode={lead.privacy_mode} />
      </ActionForm>
    </details>}
    {choice !== false && <details><summary>ถอนหรือไม่ให้ข้อมูลแบบสอบถามเพิ่มเติม</summary>
      <ActionForm action={recordPrivacy.bind(null, { ...context, requestId: randomUUID(), operation: "withdraw" })} label="ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม">
        <p>จะล้างคำตอบแบบสอบถามเพิ่มเติมรวมที่อยู่ คงข้อมูลติดต่อ ผู้ดูแล และประวัติหลักฐานไว้</p>
        <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันการถอนตัวเลือกและล้างคำตอบเพิ่มเติม</span></label>
        <DataConfirmation mode={lead.privacy_mode} />
      </ActionForm>
    </details>}
    <details><summary>ประวัติหลักฐาน ({events.length})</summary>
      <p>เวลาเป็นเวลาที่ระบบบันทึก ไม่ใช่หลักฐานเวลาที่อ่านประกาศจริง</p>
      {!events.length && <p>รายการเดิมไม่มีหลักฐานย้อนหลัง</p>}
      <ol>{events.map(event => <li key={event.id}>
        {event.kind === "initial" ? "สร้างรายการพร้อมคำขอติดต่อกลับ" : event.kind === "contact" ? "บันทึกการติดต่อ" : "เปลี่ยนตัวเลือกแบบสอบถาม"}
        {event.kind !== "contact" && ` · ${event.survey_consent ? "ให้ข้อมูลเพิ่มเติม" : "ไม่ให้ข้อมูลเพิ่มเติม"}`}
        <br />{date(event.recorded_at)} · ฉบับ {event.notice_version}
        <br />รหัสหลักฐาน: <span style={{ overflowWrap: "anywhere" }}>{event.notice_hash}</span>
      </li>)}</ol>
    </details>
  </section>;
}
