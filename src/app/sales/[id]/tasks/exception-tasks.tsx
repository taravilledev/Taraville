import { ActionForm } from "@/app/walkin/action-form";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { changeReservedUnit, saveAdjustment, saveReservation } from "../../adjustment-actions";
import { decideRefund, payRefund, requestRefund } from "../../refund-actions";
import { EvidenceUpload } from "../../evidence-upload";
import styles from "../../sales.module.css";
import { idOf, type TaskData } from "./task-data";
import { noticeClass } from "@/components/notice";

function AgreementFields({ caseId }: { caseId: string }) {
  return <>
    <label className={styles.field}>เหตุผล<textarea name="reason" required maxLength={1000} /></label>
    <label className={styles.field}>รายละเอียดข้อตกลงที่ลงนาม<textarea name="agreement" required maxLength={100000} /></label>
    <EvidenceUpload caseId={caseId} category="agreement" />
    <label className={styles.check}><input type="checkbox" name="confirmed" required />ตรวจสอบยอดและหลักฐานข้อตกลงที่ลงนามแล้ว</label>
  </>;
}
const Effect = ({ children }: { children: string }) => <p className={noticeClass} role="note">{children}</p>;

export function ChangeUnitTask({ sale, reservation }: TaskData) {
  return <ActionForm action={changeReservedUnit.bind(null, idOf(sale))} label="ยืนยันเปลี่ยนแปลง">
    <Effect>แปลงเดิมจะถูกปล่อย และแปลงใหม่จะถูกกันไว้ให้ลูกค้ารายนี้</Effect>
    <label className={styles.field}>แปลงใหม่<select name="unit" required defaultValue=""><option value="" disabled>เลือกแปลง</option>
      {(reservation?.options ?? []).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>
    {sale.status === "contracted"
      ? <label className={styles.field}>ข้อตกลงเปลี่ยนแปลงที่ลงนามแล้ว<textarea name="signed_agreement" maxLength={100000} required /><small>หากต้องแก้ยอด ให้บันทึกข้อตกลงแก้ไขยอดงวดแยก</small></label>
      : <label className={styles.field}>ราคาสุทธิที่ตกลงใหม่ (บาท)<input name="price" inputMode="decimal" required /></label>}
    <label className={styles.field}>เหตุผล<textarea name="reason" maxLength={1000} required /></label>
    <EvidenceUpload caseId={sale.id} category="agreement" />
    <label className={styles.check}><input type="checkbox" name="confirmed" required />ตรวจสอบข้อตกลงกับลูกค้าแล้ว</label>
  </ActionForm>;
}

export function AmendTask({ sale, agreement }: TaskData) {
  const rows = agreement?.instalments.filter(row => row.is_active) ?? [];
  return <ActionForm action={saveAdjustment.bind(null, "amend", idOf(sale))} label="บันทึกข้อตกลงแก้ไข">
    <Effect>ยอดงวดตามสัญญาจะถูกแทนด้วยข้อตกลงนี้ ใบเสร็จและเงินรับเดิมยังอยู่</Effect>
    {rows.map(row => <fieldset key={row.id} className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"><legend>{row.label}</legend>
      <input type="hidden" name="instalment_id" value={row.id} />
      <label className={styles.field}>ยอดเต็ม (บาท)<input name={`gross_${row.id}`} inputMode="decimal" required defaultValue={formatMoney(row.gross_cents).replaceAll(",", "")} /></label>
      <label className={styles.field}>เครดิตที่ใช้ (บาท)<input name={`credit_${row.id}`} inputMode="decimal" required defaultValue={formatMoney(row.credit_cents).replaceAll(",", "")} /></label>
    </fieldset>)}
    <label className={styles.check}><input type="checkbox" name="work_changed" />ขอบเขตงานเปลี่ยน ต้องตรวจรับงานใหม่และยกเลิกใบแจ้งชำระงวดงานเดิม</label>
    <AgreementFields caseId={sale.id} />
  </ActionForm>;
}

export function CloseTask({ sale }: TaskData) {
  return <ActionForm action={saveAdjustment.bind(null, "close", idOf(sale))} label="ยืนยันปิดงานตามข้อตกลง">
    <Effect>ข้อตกลงปิดงานแทนใบแจ้งชำระเดิมและหยุดออกงวดใหม่ ประวัติเงินรับ ใบเสร็จ และการคืนเงินยังอยู่ ย้อนกลับไม่ได้</Effect>
    <label className={styles.field}>ยอดรวมที่บริษัทมีสิทธิ์ได้รับหลังปิดงาน (บาท)<input name="retained" inputMode="decimal" required /></label>
    <AgreementFields caseId={sale.id} />
  </ActionForm>;
}

export function ReleaseTask({ sale }: TaskData) {
  return <ActionForm action={saveReservation.bind(null, "release", idOf(sale))} label="ปล่อยแปลง">
    <Effect>แปลงจะเปิดให้ลูกค้ารายอื่นจองได้ทันที</Effect>
    <label className={styles.field}>เหตุผล<textarea name="reason" required maxLength={1000} /></label>
    <label className={styles.check}><input type="checkbox" name="confirmed" required />ยืนยันเปิดแปลงให้ลูกค้ารายอื่นจองได้</label>
  </ActionForm>;
}

export function RequestRefundTask({ sale, finance }: TaskData) {
  return <ActionForm action={requestRefund.bind(null, idOf(sale))} label="ส่งคำขอคืนเงิน"><div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
    <p className={`${styles.muted} col-span-full`}>คำขอและการอนุมัติยังไม่ใช่การจ่ายคืน ต้องมีผู้ใช้อีกคนอนุมัติและบันทึกการจ่ายจริงพร้อมหลักฐาน เงินที่เป็นเครดิตสัญญาแล้วต้องแก้ข้อตกลงเครดิตก่อนจ่ายคืน</p>
    <label className={`${styles.field} col-span-full`}>คืนจากยอดรับ<select name="payment_id" required defaultValue="">
      <option value="" disabled>เลือกยอดรับ</option>
      {(finance?.payments ?? []).map(payment => <option key={payment.id} value={payment.id}>
        {formatMoney(payment.amount_cents)} บาท · {formatDate(payment.paid_date)} · คืนแล้ว {formatMoney(payment.totals.refunded_cents)} · รอดำเนินการ {formatMoney(payment.totals.reserved_refund_cents)}
      </option>)}
    </select></label>
    <label className={styles.field}>ยอดขอคืน (บาท)<input name="amount" inputMode="decimal" required /></label>
    <label className={styles.field}>เหตุผลและข้อตกลงคืนเงิน<textarea name="reason" maxLength={3000} required /></label>
  </div></ActionForm>;
}

export function DecideRefundTask({ sale, refunds, staffId, row }: TaskData) {
  const refund = refunds.find(item => item.id === row);
  if (!refund) return null;
  const mine = refund.requested_by === staffId;
  return <ActionForm action={decideRefund.bind(null, idOf(sale, refund.id))} label={mine ? "ถอนคำขอคืนเงิน" : "บันทึกผลพิจารณา"}>
    <p>{formatMoney(refund.amount_cents)} บาท · {refund.requested_by_name}</p><p>{refund.reason}</p>
    {mine ? <input type="hidden" name="decision" value="withdrawn" /> : <label className={styles.field}>ผลพิจารณา<select name="decision"><option value="approved">อนุมัติ</option><option value="rejected">ไม่อนุมัติ</option></select></label>}
    <label className={styles.field}>เหตุผลประกอบ<textarea name="note" maxLength={3000} required /></label>
  </ActionForm>;
}

export function PayRefundTask({ sale, refunds, row }: TaskData) {
  const refund = refunds.find(item => item.id === row);
  if (!refund) return null;
  return <ActionForm action={payRefund.bind(null, idOf(sale, refund.id))} label="ยืนยันจ่ายคืนเงินจริง">
    <p>{formatMoney(refund.amount_cents)} บาท · อนุมัติแล้ว</p>
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"><label className={styles.field}>วันที่จ่ายเงินจริง<input type="date" name="paid_date" required /></label>
      <label className={styles.field}>วิธีจ่าย<select name="method"><option value="transfer">โอนเงิน</option><option value="cash">เงินสด</option><option value="cheque">เช็คที่เรียกเก็บแล้ว</option></select></label><EvidenceUpload caseId={sale.id} category="refund" /></div>
    <label className={styles.check}><input type="checkbox" name="funds_confirmed" required />ตรวจสอบว่าจ่ายเงินจริงตามยอดอนุมัติและมีหลักฐานแล้ว</label>
  </ActionForm>;
}
