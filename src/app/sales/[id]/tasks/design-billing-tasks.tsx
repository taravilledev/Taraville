import { useId } from "react";
import Link from "next/link";
import { ActionForm } from "@/app/walkin/action-form";
import { formatMoney } from "@/lib/sales/money";
import { cancelDesignInvoice, issueDesignInvoice, prepareDesignPayment } from "../../design-billing-actions";
import { PaymentPaper } from "./payment-paper";
import { checkRowClass } from "@/components/check-row";
import { idOf, type TaskData } from "./task-data";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const labels = ["ส่งมอบแบบแปลน", "ส่งมอบ 3D", "ส่งมอบครบ"];
const delivered = ["ส่งมอบแบบแปลนให้ลูกค้าแล้ว", "ส่งมอบ 3D ให้ลูกค้าแล้ว", "ส่งมอบครบทุกรายการให้ลูกค้าแล้ว"];
const confirmRowClass = "flex items-start gap-3 rounded-md bg-muted p-3 [&_input]:mt-0.5 [&_input]:size-5 [&_small]:block [&_small]:text-muted-foreground";

/** Pre-issue confirmations (ADR 0058). Client-side `required` only: issuing stays allowed by the server rules, these just stop a slip. */
function BeforeIssue({ caseId, position }: { caseId: string; position: number }) {
  return <aside aria-label="ก่อนออกใบแจ้งชำระ" className="mt-4 grid gap-3 rounded-lg border bg-card p-5">
    <h2 className="m-0 text-lg">ก่อนออกใบแจ้งชำระ</h2>
    <label className={confirmRowClass}><input type="checkbox" required /><span><strong>{delivered[position - 1]}</strong>
      <small>งวดนี้เก็บเมื่อ{labels[position - 1]}</small></span></label>
    <p className="m-0 text-sm text-muted-foreground">ตรวจวันครบกำหนดบนเอกสารแล้วกด “ดูตัวอย่างเอกสาร” ระบบจะให้ยืนยันอีกครั้งก่อนออกบิลจริง · ออกแล้วแก้ไม่ได้ ถ้าผิดต้องยกเลิกใบแจ้งชำระแล้วออกใหม่</p>
    <Link className="text-sm text-primary" href={`/sales/${caseId}?tab=design`} prefetch={false}>ยกเลิก · กลับขั้นออกแบบ</Link>
    <p className="m-0 border-t pt-3 text-xs text-muted-foreground md:hidden">บนมือถือหน้านี้ดูได้อย่างเดียว · แก้บนคอมพิวเตอร์หรือ iPad</p>
  </aside>;
}
export function IssueDesignInvoiceTask({ sale, finance, row }: TaskData) {
  const position = Number(row);
  const amount = finance?.design_plan?.instalments[position - 1];
  if (!amount || !Number.isInteger(position) || position < 1 || position > 3) return null;
  return <PaymentPaper brand={sale.brand} mode="invoice" action={issueDesignInvoice.bind(null, idOf(sale, sale.id, finance?.version))}
    caseId={sale.id} customerName={sale.customer_name} customerAddress={sale.customer_snapshot?.address}
    customerPhone={sale.customer_snapshot?.phone} salesperson={sale.customer_snapshot?.salesperson}
    label={`ค่าออกแบบ งวดที่ ${position} · ${labels[position - 1]}`} amountCents={amount}
    hiddenFields={{ position: String(position) }} finalLabel="ยืนยันออกใบแจ้งชำระ" aside={<BeforeIssue caseId={sale.id} position={position} />} />;
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
  const id = useId();
  const bill = finance?.design_bills.find(item => item.id === row && item.state === "issued");
  if (!bill || bill.pending_id || bill.has_confirmed_payment || BigInt(bill.received_cents) > BigInt(0)) return null;
  return <ActionForm action={cancelDesignInvoice.bind(null, idOf(sale, bill.id, finance?.version))} label="ยืนยันยกเลิกใบแจ้งชำระ">
    <p>{bill.label} · {formatMoney(bill.amount_cents)} บาท</p>
    <p className="text-sm text-muted-foreground">บิลเดิมยังอยู่ในประวัติ การยกเลิกบิลนี้ไม่ลบรายการรับเงินจริง และไม่ได้ปลดล็อกแพ็กเกจที่เคยรับเงินแล้ว</p>
    <Field><FieldLabel htmlFor={`${id}-reason`}>เหตุผลที่ยกเลิก</FieldLabel><Textarea id={`${id}-reason`} name="reason" maxLength={1000} required /></Field>
    <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ยืนยันยกเลิกใบแจ้งชำระฉบับนี้</label>
  </ActionForm>;
}
