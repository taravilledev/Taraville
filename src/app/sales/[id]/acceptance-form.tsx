import { ActionForm } from "@/app/walkin/action-form";
import { recordAcceptance } from "../agreement-actions";
import { EvidenceUpload } from "../evidence-upload";
import styles from "../sales.module.css";

export function AcceptanceForm({ caseId, identity }: {
  caseId: string; identity: { id: string; version: number; requestId: string };
}) {
  return <ActionForm action={recordAcceptance.bind(null, identity)} label="บันทึกผลตรวจรับงานและลูกค้ายอมรับ">
    <EvidenceUpload caseId={caseId} category="acceptance" />
    <label className={styles.field}>ผลการตรวจรับ<textarea name="note" required maxLength={3000} /></label>
    <label className={styles.check}><input type="checkbox" name="inspected" required />ตรวจงานตามงวดแล้ว</label>
    <label className={styles.check}><input type="checkbox" name="customer_accepted" required />ลูกค้ายอมรับงานตามหลักฐานแล้ว</label>
  </ActionForm>;
}
