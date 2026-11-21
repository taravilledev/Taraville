import Link from "next/link";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import { paymentKinds, paymentMethods } from "@/lib/sales/financial-models";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { findTask, taskHref } from "@/lib/sales/tasks";
import type { SummaryData } from "./summary-sections";
import { MoneyDrawer } from "./money-drawers";
import * as ws from "./workspace-styles";
import * as local from "./finance-collection-styles";
import { panelClass } from "@/components/panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PendingPayments({ data, payments }: { data: SummaryData; payments: FinancialDetail["pending"] }) {
  const { sale, finance } = data;
  if (!finance || !payments.length) return null;
  const can = sale.permissions;
  if (sale.brand !== "BAAN_KUNAPAP") return <section className={panelClass} id="pending"><h2>เงินเข้ารอยืนยัน ({payments.length})</h2>
    {payments.map(payment => <div key={payment.id} className="border-t py-4 [&_p]:m-0 [&_p]:mb-2">
      <p><strong>{paymentKinds[payment.kind]} · {formatMoney(payment.amount_cents)} บาท</strong></p>
      <p>{paymentMethods[payment.method]} · {formatDate(payment.paid_date)} · {payment.payer_name}</p><p>{payment.description}</p>
      {payment.proof_path && <Link href={`/sales/${sale.id}/evidence?path=${encodeURIComponent(payment.proof_path)}`} target="_blank" prefetch={false}>เปิดหลักฐาน</Link>}
      {can["financial.confirm"] && can["receipt.issue"] && finance.issuer_ready && findTask(data.tasks, "confirm-payment", payment.id) && <p><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={taskHref(sale.id, "confirm-payment", payment.id)} prefetch={false}>ตรวจใบเสร็จและยืนยันรับเงิน</Link></p>}
      <p>{findTask(data.tasks, "withdraw-payment", payment.id) && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={taskHref(sale.id, "withdraw-payment", payment.id)} prefetch={false}>ถอนรายการที่เตรียมไว้</Link>}</p>
    </div>)}</section>;
  return <section className={ws.section} id="pending" aria-labelledby="pending-title">
    <div><h3 id="pending-title">เงินเข้ารอยืนยัน ({payments.length})</h3><p className={ws.note}>ยังไม่นับเป็นเงินรับจริงจนกว่าจะตรวจสอบและยืนยัน</p></div>
    <ul className={local.pendingRows}>{payments.map(payment => {
      const confirm = can["financial.confirm"] && can["receipt.issue"] && finance.issuer_ready && findTask(data.tasks, "confirm-payment", payment.id);
      const withdraw = findTask(data.tasks, "withdraw-payment", payment.id);
      return <li key={payment.id} className={local.pendingItem}>
        <div><h3>{paymentKinds[payment.kind]} · <strong>{formatMoney(payment.amount_cents)} บาท</strong></h3>
          <p>{paymentMethods[payment.method]} · {formatDate(payment.paid_date)} · {payment.payer_name}</p><p>{payment.description}</p>
          {!confirm && <p>รอผู้มีสิทธิ์ตรวจสอบและยืนยันรับเงิน</p>}</div>
        <div className={cn(local.actions, "max-[760px]:w-full")}>
          {confirm && <MoneyDrawer task="confirm-payment" row={payment.id} data={data} variant="default" label="ตรวจใบเสร็จและยืนยันรับเงิน" />}
          {payment.proof_path && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}/evidence?path=${encodeURIComponent(payment.proof_path)}`} target="_blank" rel="noopener noreferrer" prefetch={false}>เปิดหลักฐาน</Link>}
          {withdraw && <MoneyDrawer task="withdraw-payment" row={payment.id} data={data} label="ถอนรายการที่เตรียมไว้" />}
        </div>
      </li>;
    })}</ul>
  </section>;
}
