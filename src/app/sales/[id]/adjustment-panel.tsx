import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { SalesCase } from "@/lib/sales/models";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import { formatMoney } from "@/lib/sales/money";
import { ActionForm } from "@/app/walkin/action-form";
import { EvidenceUpload } from "../evidence-upload";
import { changeReservedUnit, saveAdjustment, saveReservation } from "../adjustment-actions";
import styles from "../sales.module.css";

export function AdjustmentPanel({ sale, agreement, reservation }: {
  sale: SalesCase; agreement: AgreementDetail; reservation: { active: boolean; options: { id: string; label: string }[] } | null;
}) {
  const rows = agreement.instalments.filter(row => row.is_active);
  const history = agreement.documents.filter(doc => doc.kind === "amendment" || doc.kind === "closeout");
  const canAmend = sale.status === "contracted" && sale.permissions["contract.amend"] && rows.length > 0;
  const canClose = sale.status !== "cancelled" && sale.permissions["contract.cancel"];
  const identity = () => ({ id: sale.id, version: sale.version, requestId: randomUUID() });
  const canRelease = reservation?.active && sale.status === "cancelled" && sale.permissions["contract.cancel"];
  const options = reservation?.options ?? [];
  if (!canAmend && !canClose && !history.length && !canRelease) return null;
  return <section className={styles.panel}><h2>แก้ข้อตกลงและปิดงาน</h2>
    {options.length > 0 && <details><summary>เปลี่ยนแปลงที่จอง</summary>
      <ActionForm action={changeReservedUnit.bind(null, identity())} label="ยืนยันเปลี่ยนแปลง">
        <label className={styles.field}>แปลงใหม่<select name="unit" required defaultValue=""><option value="" disabled>เลือกแปลง</option>
          {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select></label>
        {sale.status === "contracted"
          ? <label className={styles.field}>ข้อตกลงเปลี่ยนแปลงที่ลงนามแล้ว<textarea name="signed_agreement" maxLength={100000} required /><small>หากต้องแก้ยอด ให้บันทึกข้อตกลงแก้ไขยอดงวดแยก</small></label>
          : <label className={styles.field}>ราคาสุทธิที่ตกลงใหม่ (บาท)<input name="price" inputMode="decimal" required /></label>}
        <label className={styles.field}>เหตุผล<textarea name="reason" maxLength={1000} required /></label>
        <EvidenceUpload caseId={sale.id} category="agreement" />
        <label className={styles.check}><input type="checkbox" name="confirmed" required />ตรวจสอบข้อตกลงกับลูกค้าแล้ว</label>
      </ActionForm>
    </details>}
    {canRelease && <details id="release" open><summary>ปล่อยแปลงหลังปิดงาน</summary>
      <ActionForm action={saveReservation.bind(null, "release", identity())} label="ปล่อยแปลง">
        <label className={styles.field}>เหตุผล<textarea name="reason" required maxLength={1000} /></label>
        <label className={styles.check}><input type="checkbox" name="confirmed" required />ยืนยันเปิดแปลงให้ลูกค้ารายอื่นจองได้</label>
      </ActionForm>
    </details>}
    {history.map(doc => <p key={doc.id}><Link href={`/sales/documents/${doc.id}`} prefetch={false}>
      {doc.kind === "amendment" ? "ข้อตกลงแก้ไข" : "ข้อตกลงปิดงาน"} {doc.number}
    </Link></p>)}
    {canAmend && <details><summary>บันทึกข้อตกลงแก้ไขสัญญา</summary>
      <ActionForm action={saveAdjustment.bind(null, "amend", identity())} label="บันทึกข้อตกลงแก้ไข">
        {rows.map(row => <fieldset key={row.id} className={styles.grid}><legend>{row.label}</legend>
          <input type="hidden" name="instalment_id" value={row.id} />
          <label className={styles.field}>ยอดเต็ม (บาท)<input name={`gross_${row.id}`} inputMode="decimal" required defaultValue={formatMoney(row.gross_cents).replaceAll(",", "")} /></label>
          <label className={styles.field}>เครดิตที่ใช้ (บาท)<input name={`credit_${row.id}`} inputMode="decimal" required defaultValue={formatMoney(row.credit_cents).replaceAll(",", "")} /></label>
        </fieldset>)}
        <label className={styles.check}><input type="checkbox" name="work_changed" />ขอบเขตงานเปลี่ยน ต้องตรวจรับงานใหม่และยกเลิกใบแจ้งชำระงวดงานเดิม</label>
        <AgreementFields caseId={sale.id} />
      </ActionForm>
    </details>}
    {canClose && <details><summary>บันทึกข้อตกลงปิดงาน</summary>
      <ActionForm action={saveAdjustment.bind(null, "close", identity())} label="ยืนยันปิดงานตามข้อตกลง">
        <p>ข้อตกลงปิดงานแทนใบแจ้งชำระเดิมและหยุดออกงวดใหม่ ประวัติเงินรับ ใบเสร็จ และการคืนเงินยังอยู่</p>
        <label className={styles.field}>ยอดรวมที่บริษัทมีสิทธิ์ได้รับหลังปิดงาน (บาท)<input name="retained" inputMode="decimal" required /></label>
        <AgreementFields caseId={sale.id} />
      </ActionForm>
    </details>}
  </section>;
}

function AgreementFields({ caseId }: { caseId: string }) {
  return <>
    <label className={styles.field}>เหตุผล<textarea name="reason" required maxLength={1000} /></label>
    <label className={styles.field}>รายละเอียดข้อตกลงที่ลงนาม<textarea name="agreement" required maxLength={100000} /></label>
    <EvidenceUpload caseId={caseId} category="agreement" />
    <label className={styles.check}><input type="checkbox" name="confirmed" required />ตรวจสอบยอดและหลักฐานข้อตกลงที่ลงนามแล้ว</label>
  </>;
}

export function ReserveForm({ sale }: { sale: SalesCase }) {
  return <ActionForm action={saveReservation.bind(null, "confirm", { id: sale.id, version: sale.version, requestId: randomUUID() })} label="ยืนยันจองแปลง">
    <label className={styles.check}><input type="checkbox" name="confirmed" required />ยืนยันกันแปลงนี้ไว้ให้ลูกค้า</label>
  </ActionForm>;
}
