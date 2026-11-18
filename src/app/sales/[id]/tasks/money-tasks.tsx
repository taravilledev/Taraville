import { ActionForm } from "@/app/walkin/action-form";
import { issueInvoice } from "../../agreement-actions";
import { correctPayment, correctReceipt, preparePayment, withdrawPayment } from "../../money-actions";
import { EvidenceUpload } from "../../evidence-upload";
import { PaymentPaper } from "./payment-paper";
import { AcceptanceForm } from "../acceptance-form";
import styles from "../../sales.module.css";
import { idOf, type TaskData } from "./task-data";
import { noticeClass } from "@/components/notice";

export function PreparePaymentTask({ sale, finance }: TaskData) {
  const kindOptions = [
    ...(sale.brand === "TARAVILLE" && sale.status === "reserved" ? [{ value: "booking", label: "เงินจอง" }] : []),
    { value: "unallocated", label: "เงินเข้าที่ยังไม่ระบุงวด" },
  ];
  return <>
    {sale.brand === "BAAN_KUNAPAP" && <p className="text-sm text-muted-foreground">รับค่าออกแบบผ่านบิลรายงวดในหน้าการเงิน</p>}
    {sale.brand === "TARAVILLE" && sale.status === "reserved" && <p className="text-sm text-muted-foreground">ก่อนเตรียมรับเงินจอง ให้บันทึกยอดจองในสรุปการจองของแปลงและราคาปัจจุบัน</p>}
    <PaymentPaper brand={sale.brand} mode="receipt" action={preparePayment.bind(null, idOf(sale, sale.id, finance?.version))} caseId={sale.id}
      customerPhone={sale.customer_snapshot?.phone} salesperson={sale.customer_snapshot?.salesperson}
      customerName={sale.customer_name} customerAddress={sale.customer_snapshot?.address} label="เงินเข้าที่ยังไม่ระบุงวด"
      amountCents="0" amountEditable kindOptions={kindOptions} initialKind="unallocated" description=""
      hiddenFields={{ invoice_id: "" }} finalLabel="ส่งรายการรับเงินเพื่อตรวจยืนยัน" />
  </>;
}

export function PrepareInstalmentTask({ sale, finance, agreement, row }: TaskData) {
  const item = agreement?.instalments.find(candidate => candidate.id === row);
  if (!item?.balance) return null;
  return <PaymentPaper brand={sale.brand} mode="receipt" action={preparePayment.bind(null, idOf(sale, sale.id, finance?.version))} caseId={sale.id}
    customerPhone={sale.customer_snapshot?.phone} salesperson={sale.customer_snapshot?.salesperson}
    customerName={sale.customer_name} customerAddress={sale.customer_snapshot?.address} label={item.label}
    amountCents={item.balance.outstanding_cents} amountEditable hiddenFields={{ kind: "instalment", invoice_id: item.invoice_id ?? "" }}
    finalLabel="ส่งรายการรับเงินงวดนี้เพื่อตรวจยืนยัน" />;
}

export function WithdrawPaymentTask({ sale, finance, row }: TaskData) {
  return <ActionForm action={withdrawPayment.bind(null, idOf(sale, row ?? "", finance?.version ?? 0))} label="ถอนรายการรับเงิน">
    <label className={styles.field}>เหตุผล<textarea name="reason" maxLength={1000} required /></label>
    <label className={styles.check}><input type="checkbox" name="confirmed" required />ยืนยันถอนรายการนี้จากคิวรอตรวจ</label>
  </ActionForm>;
}

/** One question: what is wrong with this receipt. Each answer is its own form, both visible. */
export function FixReceiptTask({ sale, finance, row }: TaskData) {
  const doc = finance?.documents.find(candidate => candidate.id === row);
  if (!doc) return null;
  const can = sale.permissions;
  const canReplace = can["receipt.cancel"] && (doc.state === "issued" || can["receipt.issue"]);
  const isDesignBillReceipt = finance?.design_bills.some(bill => bill.receipt_document_id === doc.id);
  const canAmount = !isDesignBillReceipt && doc.state === "issued" && ["financial.prepare", "financial.confirm", "receipt.cancel", "receipt.issue"].every(key => can[key]);
  return <>
    <p>ใบเสร็จ {doc.number}{doc.state === "cancelled" ? " · ยกเลิกแล้ว" : ""}</p>
    {canReplace && <section><h3>เอกสารผิด: ยกเลิกหรือออกทดแทน</h3>
      <ActionForm action={correctReceipt.bind(null, idOf(sale, doc.id))} label="บันทึกการแก้ไขใบเสร็จ">
        <p>ยอดรับเงินจริงและยอดจัดสรรจะคงเดิม</p>
        <label className={styles.field}>เหตุผล<textarea name="reason" maxLength={1000} required /></label>
        {can["receipt.issue"] && <label className={styles.field}>รายละเอียดในใบเสร็จทดแทน
          <textarea name="description" maxLength={1000} required={doc.state === "cancelled"} />
          {doc.state === "issued" && <small>เว้นว่างเพื่อยกเลิกใบเสร็จอย่างเดียว</small>}
        </label>}
        <label className={styles.check}><input type="checkbox" name="confirmed" required />ยืนยันการแก้ไขเอกสารฉบับนี้</label>
      </ActionForm></section>}
    {canAmount && <section><h3>ยอดรับจริงที่บันทึกผิด</h3>
      <ActionForm action={correctPayment.bind(null, idOf(sale, doc.id))} label="ยืนยันยอดรับจริงที่ถูกต้อง">
        <label className={styles.field}>ยอดที่รับจริง (บาท)<input name="amount" inputMode="decimal" required /></label>
        <label className={styles.field}>เหตุผล<textarea name="reason" maxLength={1000} required /></label>
        <EvidenceUpload caseId={sale.id} category="payment" />
        <label className={styles.check}><input type="checkbox" name="confirmed" required />ตรวจสอบหลักฐานยอดรับจริงแล้ว รายการนี้เป็นการแก้บันทึก</label>
      </ActionForm></section>}
  </>;
}

export function IssueInvoiceTask({ sale, agreement, row }: TaskData) {
  const item = agreement?.instalments.find(candidate => candidate.id === row);
  if (!item) return null;
  const contract = agreement?.documents.find(doc => doc.id === item.contract_id);
  const hasAcceptanceDue = sale.brand === "BAAN_KUNAPAP" && item.needs_acceptance && contract?.payload.contract_paper?.payment_due_days === 30;
  if (hasAcceptanceDue && (!item.acceptance_date || !item.due_date)) return <p className={noticeClass}>ยังไม่มีวันที่ตรวจรับจริงและวันครบกำหนดของงวดนี้ กรุณาตรวจข้อมูลการตรวจรับก่อนออกบิล</p>;
  return <>
    {item.net_cents === "0" && <p className="text-sm text-muted-foreground">ชำระครบด้วยเครดิตเดิม ไม่รับเงินใหม่และไม่ออกใบเสร็จซ้ำ</p>}
    <PaymentPaper brand={sale.brand} mode="invoice" action={issueInvoice.bind(null, idOf(sale, item.id))} caseId={sale.id}
      customerName={sale.customer_name} customerAddress={sale.customer_snapshot?.address} label={item.label} amountCents={item.net_cents}
      customerPhone={sale.customer_snapshot?.phone} salesperson={sale.customer_snapshot?.salesperson}
      grossCents={item.gross_cents} creditCents={item.credit_cents}
      fixedDueDate={hasAcceptanceDue ? item.due_date ?? undefined : undefined} acceptanceDate={hasAcceptanceDue ? item.acceptance_date ?? undefined : undefined}
      finalLabel={item.net_cents === "0" ? "บันทึกงวดที่ชำระครบด้วยเครดิตเดิม" : "ยืนยันออกใบแจ้งชำระ"} />
  </>;
}

export function AcceptanceTask({ sale, agreement, work, row }: TaskData) {
  const item = agreement?.instalments.find(candidate => candidate.id === row);
  const contract = agreement?.documents.find(doc => doc.id === item?.contract_id);
  const requiresDate = contract?.payload.contract_paper?.payment_due_days === 30 || !!work?.find(item => item.id === row)?.requires_acceptance_date;
  return <AcceptanceForm caseId={sale.id} identity={idOf(sale, row)} requiresDate={requiresDate} />;
}
