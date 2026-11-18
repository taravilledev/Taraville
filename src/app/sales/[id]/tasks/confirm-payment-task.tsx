import Link from "next/link";
import { ActionForm } from "@/app/walkin/action-form";
import { confirmPayment } from "../../money-actions";
import { PaymentPaperPreview } from "./payment-paper";
import { paymentKinds } from "@/lib/sales/financial-models";
import type { TaskData } from "./task-data";
import { idOf } from "./task-data";
import styles from "../../sales.module.css";
import { panelClass } from "@/components/panel";

export function ConfirmPaymentTask({ sale, finance, row }: TaskData) {
  const payment = finance?.pending.find(item => item.id === row);
  if (!payment || !finance?.issuer_ready) return <p role="status">ยังยืนยันไม่ได้ กรุณาตรวจรายการและการตั้งค่าบริษัทผู้ออกเอกสาร</p>;
  return <div className="grid gap-6">
    <PaymentPaperPreview mode="receipt" brand={sale.brand} customerName={sale.customer_name} customerAddress={sale.customer_snapshot?.address}
      customerPhone={sale.customer_snapshot?.phone} salesperson={sale.customer_snapshot?.salesperson} receiptKind={payment.kind}
      label={paymentKinds[payment.kind]} amountCents={payment.amount_cents} date={payment.paid_date} method={payment.method}
      payerName={payment.payer_name} description={payment.description} />
    <section className={panelClass}><h3>ตรวจรับเงินจริงก่อนออกใบเสร็จ</h3>
      {payment.proof_path ? <p><Link href={`/sales/${sale.id}/evidence?path=${encodeURIComponent(payment.proof_path)}`} target="_blank" prefetch={false}>เปิดหลักฐานการรับเงิน</Link></p> : <p>รายการเงินสด · ไม่มีไฟล์หลักฐานแนบ</p>}
      <ActionForm action={confirmPayment.bind(null, idOf(sale, payment.id, finance.version))} label="ยืนยันรับเงินจริงและออกใบเสร็จ">
        <p className={styles.muted}>เมื่อยืนยันแล้วจึงนับยอดรับจริงและออกเลขใบเสร็จ ไม่สามารถแก้ยอดบนเอกสารตัวอย่างนี้</p>
        <label className={styles.check}><input type="checkbox" name="funds_confirmed" required />ตรวจสอบยอด วันที่ วิธีรับเงิน และได้รับเงินจริงแล้ว</label>
      </ActionForm>
      {sale.permissions["financial.prepare"] && <p><Link className={styles.link} href={`/sales/${sale.id}?task=withdraw-payment&row=${payment.id}`} prefetch={false}>ข้อมูลผิด · ถอนรายการแล้วบันทึกใหม่</Link></p>}
    </section>
  </div>;
}
