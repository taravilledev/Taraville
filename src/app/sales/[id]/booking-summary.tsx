import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ActionForm } from "@/app/walkin/action-form";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import type { SalesCase } from "@/lib/sales/models";
import { saveBookingSummary } from "../adjustment-actions";
import { signPropertyContract } from "../agreement-actions";
import { formatDate } from "@/lib/sales/date";
import { EvidenceUpload } from "../evidence-upload";
import styles from "../sales.module.css";

export function BookingSummary({ sale, finance }: { sale: SalesCase; finance: FinancialDetail }) {
  if (sale.brand !== "TARAVILLE") return null;
  const documents = finance.documents.filter(doc => doc.kind === "summary");
  const canSave = sale.permissions["financial.prepare"] && sale.net_price_cents != null && ["draft", "reserved"].includes(sale.status);
  if (!canSave && !documents.length) return null;
  return <section className={styles.panel} id="summary"><h2>สรุปการจอง</h2>
    {documents.map(doc => <p key={doc.id}><Link href={`/sales/documents/${doc.id}`} prefetch={false}>{doc.number} · {formatDate(doc.document_date)}</Link></p>)}
    {canSave && <ActionForm action={saveBookingSummary.bind(null, { id: sale.id, version: sale.version, requestId: randomUUID() })} label="บันทึกสรุปการจอง">
      <p>บันทึกเอกสารแต่ละฉบับจากข้อมูลการขายล่าสุด การบันทึกเอกสารไม่กันแปลง</p>
      <div className={styles.grid}>
        <label className={styles.field}>ยอดจอง (บาท)<input name="booking" inputMode="decimal" /></label>
        <label className={styles.field}>ยอดวันทำสัญญา (บาท)<input name="contract" inputMode="decimal" /></label>
        <label className={styles.field}>ยอดดาวน์รวม (บาท)<input name="down" inputMode="decimal" /></label>
        <label className={styles.field}>ยอดยื่นกู้ (บาท)<input name="mortgage" inputMode="decimal" /></label>
        <label className={styles.field}>วันนัดจอง<input name="booking_date" type="date" /></label>
        <label className={styles.field}>วันนัดทำสัญญา<input name="contract_date" type="date" /></label>
        <label className={styles.field}>วันนัดดาวน์งวดแรก<input name="down_date" type="date" /></label>
        <label className={styles.field}>เงื่อนไข<textarea name="conditions" maxLength={5000} /></label>
        <label className={styles.field}>ของแถม<textarea name="freebies" maxLength={5000} /></label>
      </div>
    </ActionForm>}
    {sale.status === "reserved" && sale.permissions["contract.sign"] && documents.length > 0 && <details><summary>บันทึกสัญญาขายที่ลงนามแล้ว</summary>
      <ActionForm action={signPropertyContract.bind(null, { id: sale.id, version: sale.version, requestId: randomUUID() })} label="บันทึกสัญญาขาย">
        <label className={styles.field}>สรุปการจองที่ตกลง<select name="summary_id" required defaultValue="">
          <option value="" disabled>เลือกเอกสาร</option>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.number}</option>)}
        </select></label>
        <label className={styles.field}>จำนวนงวดดาวน์ (0 หากไม่มี)<input name="down_count" type="number" min={0} max={98} step={1} required /></label>
        <EvidenceUpload caseId={sale.id} category="agreement" />
        <label className={styles.check}><input type="checkbox" name="confirmed" required />ตรวจสอบสัญญาที่ลงนามและยอดเงินจองแล้ว</label>
      </ActionForm>
    </details>}
    {finance.documents.filter(doc => doc.kind === "contract").map(doc => <p key={doc.id}><Link href={`/sales/documents/${doc.id}`} prefetch={false}>สัญญาขาย {doc.number}</Link></p>)}
  </section>;
}
