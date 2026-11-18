import { ActionForm } from "@/app/walkin/action-form";
import { formatMoney } from "@/lib/sales/money";
import { cancelDesignInvoice, issueDesignInvoice, prepareDesignPayment } from "../../design-billing-actions";
import { PaymentPaper } from "./payment-paper";
import styles from "../../sales.module.css";
import { idOf, type TaskData } from "./task-data";

const labels = ["ส่งมอบแบบแปลน", "ส่งมอบ 3D", "ส่งมอบครบ"];
export function IssueDesignInvoiceTask({ sale, finance, row }: TaskData) {
  const position = Number(row);
  const amount = finance?.design_plan?.instalments[position - 1];
  if (!amount || !Number.isInteger(position) || position < 1 || position > 3) return null;
  return <PaymentPaper brand={sale.brand} mode="invoice" action={issueDesignInvoice.bind(null, idOf(sale, sale.id, finance?.version))}
    caseId={sale.id} customerName={sale.customer_name} customerAddress={sale.customer_snapshot?.address}
    customerPhone={sale.customer_snapshot?.phone} salesperson={sale.customer_snapshot?.salesperson}
    label={`ค่าออกแบบ งวดที่ ${position} · ${labels[position - 1]}`} amountCents={amount}
    hiddenFields={{ position: String(position) }} finalLabel="ยืนยันออกใบแจ้งชำระ" />;
}
export function PrepareDesignPaymentTask({ sale, finance, row }: TaskData) {
  const bill = finance?.design_bills.find(item => item.id === row && item.state === "issued");
  if (!bill || bill.pending_id || bill.has_confirmed_payment || BigInt(bill.received_cents) > BigInt(0)) return null;
  return <PaymentPaper brand={sale.brand} mode="receipt" action={prepareDesignPayment.bind(null, idOf(sale, bill.id, finance?.version))}
    caseId={sale.id} customerName={sale.customer_name} customerAddress={sale.customer_snapshot?.address}
    customerPhone={sale.customer_snapshot?.phone} salesperson={sale.customer_snapshot?.salesperson}
    label={bill.label} amountCents={bill.amount_cents} initialKind="design_fee" finalLabel="ส่งรายการรับเงินเพื่อตรวจยืนยัน" />;
}
export function CancelDesignInvoiceTask({ sale, finance, row }: TaskData) {
  const bill = finance?.design_bills.find(item => item.id === row && item.state === "issued");
  if (!bill || bill.pending_id || bill.has_confirmed_payment || BigInt(bill.received_cents) > BigInt(0)) return null;
  return <ActionForm action={cancelDesignInvoice.bind(null, idOf(sale, bill.id, finance?.version))} label="ยืนยันยกเลิกใบแจ้งชำระ">
    <p>{bill.label} · {formatMoney(bill.amount_cents)} บาท</p>
    <p className="text-sm text-muted-foreground">บิลเดิมยังอยู่ในประวัติ การยกเลิกบิลนี้ไม่ลบรายการรับเงินจริง และไม่ได้ปลดล็อกแพ็กเกจที่เคยรับเงินแล้ว</p>
    <label className={styles.field}>เหตุผลที่ยกเลิก<textarea name="reason" maxLength={1000} required /></label>
    <label className={styles.check}><input type="checkbox" name="confirmed" required />ยืนยันยกเลิกใบแจ้งชำระฉบับนี้</label>
  </ActionForm>;
}
