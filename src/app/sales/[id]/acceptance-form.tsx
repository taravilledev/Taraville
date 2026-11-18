import { ActionForm } from "@/app/walkin/action-form";
import { recordAcceptance } from "../agreement-actions";
import { EvidenceUpload } from "../evidence-upload";
import styles from "../sales.module.css";
import { checkRowClass } from "@/components/check-row";

export function AcceptanceForm({ caseId, identity, requiresDate = false }: {
  caseId: string; identity: { id: string; version: number; requestId: string };
  requiresDate?: boolean;
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <ActionForm action={recordAcceptance.bind(null, identity)} label="บันทึกผลตรวจรับงานและลูกค้ายอมรับ">
    {requiresDate && <label className={styles.field}>วันที่ตรวจรับจริง<input type="date" name="acceptance_date" required defaultValue={today} max={today} />
      <small>ใช้วันที่ตรวจรับจริงตามหลักฐาน ระบบจะกำหนดชำระภายใน 30 วันปฏิทินหลังวันที่ระบุ</small></label>}
    <EvidenceUpload caseId={caseId} category="acceptance" />
    <label className={styles.field}>ผลการตรวจรับ<textarea name="note" required maxLength={3000} /></label>
    <label className={checkRowClass}><input type="checkbox" name="inspected" required />ตรวจงานตามงวดแล้ว</label>
    <label className={checkRowClass}><input type="checkbox" name="customer_accepted" required />ลูกค้ายอมรับงานตามหลักฐานแล้ว</label>
  </ActionForm>;
}
