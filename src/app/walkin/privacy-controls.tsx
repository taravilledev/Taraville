import { randomUUID } from "node:crypto";
import type { Lead } from "@/lib/walkin/models";
import { privacyNotice, type PrivacyEvent } from "@/lib/walkin/privacy";
import { ActionForm } from "./action-form";
import { recordPrivacy } from "./privacy-actions";
import { VersionedNotice } from "./versioned-notice";
import { formHintClass } from "@/components/form-card";
import { Status, type StatusTone } from "@/components/status";
import { walkinOptionClass } from "./walkin-form-styles";

export const formatDate = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
const mutation = (lead: Lead, operation: "opt_in" | "withdraw") =>
  recordPrivacy.bind(null, { id: lead.id, version: lead.version, requestId: randomUUID(), operation });

const choiceStatus = (choice: boolean | null): [StatusTone, string] =>
  choice === null ? ["waiting", "ยังไม่มีหลักฐานตัวเลือก"] : choice ? ["success", "ลูกค้าเลือกให้ข้อมูลเพิ่มเติม"] : ["inactive", "ลูกค้าไม่ให้ข้อมูลเพิ่มเติม"];

export function SurveyChoiceStatus({ choice }: { choice: boolean | null }) {
  const [tone, label] = choiceStatus(choice);
  return <Status tone={tone}>{label}</Status>;
}

/** Inside the survey drawer: opt in (verbatim notice and both ticks) or withdraw and wipe the extra answers. */
export function SurveyChoice({ lead, choice }: { lead: Lead; choice: boolean | null }) {
  const notice = privacyNotice(lead.privacy_mode);
  return <>
    {choice !== true && <section className="grid gap-3"><h3>เลือกให้ข้อมูลแบบสอบถามเพิ่มเติม</h3>
      <VersionedNotice brand={lead.brand} mode={lead.privacy_mode} />
      <ActionForm action={mutation(lead, "opt_in")} label="ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม">
        <label className={walkinOptionClass}><input type="checkbox" name="notice_presented" required /><span>{notice.choices.notice_presented}</span></label>
        <label className={walkinOptionClass}><input type="checkbox" name="confirm_operation" required /><span>{notice.choices.survey_consent}</span></label>
      </ActionForm>
    </section>}
    {choice !== false && <section className="grid gap-3"><h3>ถอนหรือไม่ให้ข้อมูลแบบสอบถามเพิ่มเติม</h3>
      <ActionForm action={mutation(lead, "withdraw")} label="ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม" destructive>
        <p className={formHintClass}>จะล้างคำตอบแบบสอบถามเพิ่มเติมรวมที่อยู่ คงข้อมูลติดต่อ ผู้ดูแล และประวัติหลักฐานไว้ ย้อนกลับไม่ได้</p>
        <label className={walkinOptionClass}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันการถอนตัวเลือกและล้างคำตอบเพิ่มเติม</span></label>
      </ActionForm>
    </section>}
  </>;
}

export function EvidenceHistory({ events, actors }: { events: PrivacyEvent[]; actors: Map<string, string> }) {
  return <>
    <p className={formHintClass}>เวลาเป็นเวลาที่ระบบบันทึก ไม่ใช่หลักฐานเวลาที่อ่านประกาศจริง</p>
    {!events.length && <p>รายการเดิมไม่มีหลักฐานย้อนหลัง</p>}
    <ol aria-label="ประวัติหลักฐาน เรียงใหม่สุดก่อน" className="m-0 grid list-none p-0">{events.map(event => <li key={event.id} className="grid gap-1 border-b py-3 text-sm [overflow-wrap:anywhere]">
      <strong>{event.kind === "initial" ? "สร้างรายการพร้อมคำขอติดต่อกลับ" : event.kind === "contact" ? "บันทึกการติดต่อ" : "เปลี่ยนตัวเลือกแบบสอบถาม"}
        {event.kind !== "contact" && ` · ${event.survey_consent ? "ให้ข้อมูลเพิ่มเติม" : "ไม่ให้ข้อมูลเพิ่มเติม"}`}</strong>
      <span>{formatDate(event.recorded_at)} · ฉบับ {event.notice_version}</span>
      <span>บันทึกโดย {actors.get(event.actor_id) ?? "เจ้าหน้าที่อื่น"}</span>
      <span className="text-muted-foreground">รหัสหลักฐาน: {event.notice_hash}</span>
    </li>)}</ol>
  </>;
}
