import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { SalesCase } from "@/lib/sales/models";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import type { Refund } from "@/lib/sales/refund-models";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { ActionForm } from "@/app/walkin/action-form";
import { decideRefund, payRefund, requestRefund } from "../refund-actions";
import { EvidenceUpload } from "../evidence-upload";
import styles from "../sales.module.css";

const states = { pending: "รออนุมัติ", approved: "อนุมัติ รอจ่าย", rejected: "ไม่อนุมัติ", withdrawn: "ถอนคำขอ", paid: "จ่ายคืนแล้ว" };
export function RefundPanel({ sale, finance, refunds, staffId }: { sale: SalesCase; finance: FinancialDetail; refunds: Refund[]; staffId: string }) {
  const identity = (id: string) => ({ id, version: sale.version, requestId: randomUUID() });
  return <section className={styles.panel} id="refunds"><h2>คืนเงินจริง</h2>
    <p className={styles.muted}>คำขอและการอนุมัติยังไม่ใช่การจ่ายคืน ต้องมีผู้ใช้อีกคนอนุมัติและบันทึกการจ่ายจริงพร้อมหลักฐาน เงินที่เป็นเครดิตสัญญาแล้วต้องแก้ข้อตกลงเครดิตก่อนจ่ายคืน</p>
    {sale.permissions["refund.request"] && finance.payments.length > 0 && <details><summary>ขอคืนเงิน</summary>
      <ActionForm action={requestRefund.bind(null, identity(sale.id))} label="ส่งคำขอคืนเงิน"><div className={styles.grid}>
        <label className={`${styles.field} ${styles.full}`}>คืนจากยอดรับ<select name="payment_id" required defaultValue="">
          <option value="" disabled>เลือกยอดรับ</option>
          {finance.payments.map(payment => <option key={payment.id} value={payment.id}>
            {formatMoney(payment.amount_cents)} บาท · {formatDate(payment.paid_date)} · คืนแล้ว {formatMoney(payment.totals.refunded_cents)} · รอดำเนินการ {formatMoney(payment.totals.reserved_refund_cents)}
          </option>)}
        </select></label>
        <label className={styles.field}>ยอดขอคืน (บาท)<input name="amount" inputMode="decimal" required /></label>
        <label className={styles.field}>เหตุผลและข้อตกลงคืนเงิน<textarea name="reason" maxLength={3000} required /></label>
      </div></ActionForm>
    </details>}
    {!refunds.length && <p className={styles.muted}>ยังไม่มีคำขอคืนเงิน</p>}
    {refunds.map(refund => <details key={refund.id}><summary>{formatMoney(refund.amount_cents)} บาท · {states[refund.state]} · {refund.requested_by_name}</summary>
      <p>{refund.reason}</p>{refund.decision_note && <p>ผลพิจารณา: {refund.decision_note}</p>}
      {refund.state === "pending" && ((refund.requested_by === staffId && sale.permissions["refund.request"]) || (refund.requested_by !== staffId && sale.permissions["refund.approve"])) && <ActionForm action={decideRefund.bind(null, identity(refund.id))} label={refund.requested_by === staffId ? "ถอนคำขอคืนเงิน" : "บันทึกผลพิจารณา"}>
        {refund.requested_by === staffId ? <input type="hidden" name="decision" value="withdrawn" /> : <label className={styles.field}>ผลพิจารณา<select name="decision"><option value="approved">อนุมัติ</option><option value="rejected">ไม่อนุมัติ</option></select></label>}
        <label className={styles.field}>เหตุผลประกอบ<textarea name="note" maxLength={3000} required /></label>
      </ActionForm>}
      {refund.state === "approved" && sale.permissions["refund.pay"] && <ActionForm action={payRefund.bind(null, identity(refund.id))} label="ยืนยันจ่ายคืนเงินจริง">
        <div className={styles.grid}><label className={styles.field}>วันที่จ่ายเงินจริง<input type="date" name="paid_date" required /></label>
          <label className={styles.field}>วิธีจ่าย<select name="method"><option value="transfer">โอนเงิน</option><option value="cash">เงินสด</option><option value="cheque">เช็คที่เรียกเก็บแล้ว</option></select></label><EvidenceUpload caseId={sale.id} category="refund" /></div>
        <label className={styles.check}><input type="checkbox" name="funds_confirmed" required />ตรวจสอบว่าจ่ายเงินจริงตามยอดอนุมัติและมีหลักฐานแล้ว</label>
      </ActionForm>}
      {refund.document_id && <p><Link href={`/sales/documents/${refund.document_id}`} prefetch={false}>เปิดเอกสารจ่ายคืน</Link></p>}
    </details>)}
  </section>;
}
