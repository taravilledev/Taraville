import { randomUUID } from "node:crypto";
import type { Lead } from "@/lib/walkin/models";
import { CLOSE_REASON_LABELS, closeReasonsFor } from "@/lib/walkin/lead-stage";
import { ActionForm } from "./action-form";
import { closeLead, reopenLead } from "./status-actions";
import { formatDate } from "./privacy-controls";
import styles from "./walkin.module.css";

type CloseInfo = { text: string | null; by: string | null } | null;
type Props = { lead: Lead; info: CloseInfo; hasActiveProject: boolean; canEdit: boolean; openWorkCount: number };

export function LeadStatus({ lead, info, hasActiveProject, canEdit, openWorkCount }: Props) {
  const context = { id: lead.id, version: lead.version, requestId: randomUUID() };
  if (lead.closed_at && lead.closed_reason) {
    return <section className={styles.card}><h2>สถานะ: ปิด</h2>
      <p>{CLOSE_REASON_LABELS[lead.closed_reason]}{info?.text ? ` · ${info.text}` : ""}<br />
        โดย {info?.by ?? "เจ้าหน้าที่อื่น"} · {formatDate(lead.closed_at)}</p>
      {canEdit && <ActionForm action={reopenLead.bind(null, context)} label="ยืนยันเปิดรายการอีกครั้ง">
        <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันเปิดรายการนี้อีกครั้ง</span></label>
      </ActionForm>}
    </section>;
  }
  if (!canEdit) return null;
  if (hasActiveProject) return <section className={styles.card}><h2>ปิดรายการ</h2>
    <p className={styles.hint}>ปิดรายการไม่ได้ขณะมีโครงการที่ใช้งานอยู่ (ADR 0008)</p></section>;
  return <section className={styles.card}><h2>ปิดรายการนี้</h2>
    {openWorkCount > 0 && <p className={styles.hint} role="note">ลูกค้ารายนี้ยังมีรายการขายที่ดำเนินอยู่ {openWorkCount} รายการ การปิดรายการไม่ได้ยกเลิกรายการเหล่านั้น</p>}
    <ActionForm action={closeLead.bind(null, context)} label="ยืนยันปิดรายการ">
      <label className={styles.field}><span>เหตุผล</span><select name="reason" defaultValue="" required>
        <option value="">เลือกเหตุผล</option>
        {closeReasonsFor(lead.brand).map(code => <option key={code} value={code}>{CLOSE_REASON_LABELS[code]}</option>)}
      </select></label>
      <label className={styles.field}><span>รายละเอียด (เฉพาะเมื่อเลือก “อื่นๆ” และต้องกรอก)</span><input name="reason_text" maxLength={500} /></label>
      <p className={styles.hint}>รายการที่ปิดยังแก้ไขและบันทึกการติดต่อได้ และเปิดอีกครั้งได้ ไม่ใช่การลบข้อมูลหรือการขอไม่ให้ติดต่อ</p>
      <label className={styles.option}><input type="checkbox" name="confirm_operation" required /><span>ยืนยันปิดรายการนี้</span></label>
    </ActionForm>
  </section>;
}
