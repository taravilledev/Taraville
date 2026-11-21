import Link from "next/link";
import { ActionForm } from "@/app/walkin/action-form";
import { confirmPayment } from "../../money-actions";
import { PaymentPaperPreview } from "./payment-paper";
import { paymentKinds } from "@/lib/sales/financial-models";
import type { TaskData } from "./task-data";
import { idOf } from "./task-data";
import { checkRowClass } from "@/components/check-row";
import { panelClass } from "@/components/panel";
import { buttonVariants } from "@/components/ui/button";

/** In a drawer (`isDrawer`) the paper preview folds away and the withdraw link goes (the row has its own withdraw drawer); the full page shows both. */
export function ConfirmPaymentTask({ sale, finance, row, isDrawer = false }: Pick<TaskData, "sale" | "finance" | "row"> & { isDrawer?: boolean }) {
  const payment = finance?.pending.find(item => item.id === row);
  if (!payment || !finance?.issuer_ready) return <p role="status">ยังยืนยันไม่ได้ กรุณาตรวจรายการและการตั้งค่าบริษัทผู้ออกเอกสาร</p>;
  const preview = <PaymentPaperPreview mode="receipt" brand={sale.brand} customerName={sale.customer_name} customerAddress={sale.customer_snapshot?.address}
      customerPhone={sale.customer_snapshot?.phone} salesperson={sale.customer_snapshot?.salesperson} receiptKind={payment.kind}
      label={paymentKinds[payment.kind]} amountCents={payment.amount_cents} date={payment.paid_date} method={payment.method}
      payerName={payment.payer_name} description={payment.description} />;
  return <div className="grid gap-6">
    {isDrawer ? <details className="overflow-x-auto"><summary className="cursor-pointer py-2 text-sm font-semibold">ดูตัวอย่างใบเสร็จก่อนออกเลข</summary>{preview}</details> : preview}
    <section className={panelClass}><h3>ตรวจรับเงินจริงก่อนออกใบเสร็จ</h3>
      {payment.proof_path ? <p><Link href={`/sales/${sale.id}/evidence?path=${encodeURIComponent(payment.proof_path)}`} target="_blank" prefetch={false}>เปิดหลักฐานการรับเงิน</Link></p> : <p>รายการเงินสด · ไม่มีไฟล์หลักฐานแนบ</p>}
      <ActionForm action={confirmPayment.bind(null, idOf(sale, payment.id, finance.version))} label="ยืนยันรับเงินจริงและออกใบเสร็จ">
        <p className="text-sm text-muted-foreground">เมื่อยืนยันแล้วจึงนับยอดรับจริงและออกเลขใบเสร็จ ไม่สามารถแก้ยอดบนเอกสารตัวอย่างนี้</p>
        <label className={checkRowClass}><input type="checkbox" name="funds_confirmed" required />ตรวจสอบยอด วันที่ วิธีรับเงิน และได้รับเงินจริงแล้ว</label>
      </ActionForm>
      {!isDrawer && sale.permissions["financial.prepare"] && <p><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}?task=withdraw-payment&row=${payment.id}`} prefetch={false}>ข้อมูลผิด · ถอนรายการแล้วบันทึกใหม่</Link></p>}
    </section>
  </div>;
}
