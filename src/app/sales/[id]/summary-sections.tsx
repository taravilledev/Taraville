import Link from "next/link";
import type { ReactNode } from "react";
import { refundStates, type SalesCase } from "@/lib/sales/models";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { Refund } from "@/lib/sales/refund-models";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { findTask, taskHref, taskLabels, type Task, type TaskName } from "@/lib/sales/tasks";
import { BkpDocuments } from "./bkp-documents";
import { PendingPayments } from "./pending-payments";
export { PendingPayments } from "./pending-payments";
import { factsClass } from "@/components/facts";
import * as ws from "./workspace-styles";
import { panelClass } from "@/components/panel";
import { noticeClass } from "@/components/notice";
import { Status } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const moneyDisclosureClass = cn(panelClass, "[&>summary]:min-h-11 [&>summary]:cursor-pointer [&>summary]:py-2 [&>summary]:text-md [&>summary]:font-semibold [&>summary:focus-visible]:outline-2 [&>summary:focus-visible]:outline-offset-2 [&>summary:focus-visible]:outline-primary [&[open]>summary]:mb-3");

export type Closeout = { document_id: string; retained_cents: string; received_cents: string; remaining_cents: string; refund_due_cents: string } | null;
export type SummaryData = {
  sale: SalesCase; finance: FinancialDetail | null; agreement: AgreementDetail | null; refunds: Refund[]; closeout: Closeout; tasks: Task[];
  summary?: { net: string | null; received: string; outstanding: string | null } | null;
  work: { id: string; position: number; progress_percent: number | null; accepted: boolean }[];
};
const managementActions: Partial<Record<TaskName, { title: string; description: string }>> = {
  assign: { title: "เปลี่ยนผู้รับผิดชอบ", description: "มอบหมายงานนี้ให้ผู้ดูแลคนใหม่" },
  amend: { title: "แก้ไขสัญญา", description: "ปรับยอดงวดหรือขอบเขตงานตามข้อตกลงที่ลงนามแล้ว" },
  close: { title: "ปิดงานตามข้อตกลง", description: "หยุดออกงวดใหม่และสรุปยอดตามข้อตกลงปิดงาน" },
  "change-unit": { title: "เปลี่ยนแปลงที่จอง", description: "เลือกแปลงใหม่ให้รายการขายนี้" },
  release: { title: "ปล่อยแปลงหลังปิดงาน", description: "คืนแปลงที่ยังกันไว้ให้กลับมาเปิดขายได้" },
  "request-refund": { title: "ขอคืนเงิน", description: "ส่งคำขอให้ผู้มีสิทธิ์พิจารณาก่อนจ่ายคืน" },
};

/** A link to a task, shown only when the registry says the reader may open it. */
function TaskLink({ data, name, row, children }: { data: SummaryData; name: TaskName; row?: string; children?: ReactNode }) {
  if (!findTask(data.tasks, name, row)) return null;
  return <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={taskHref(data.sale.id, name, row)} prefetch={false}>{children ?? taskLabels[name]}</Link>;
}

export function OverviewSection({ data, houseBrief }: { data: SummaryData; houseBrief: ReactNode }) {
  const { sale, work } = data;
  const exceptions = data.tasks.filter(task => task.group === "exception" && !task.row);
  const managementTasks = [
    ...exceptions.filter(task => task.name === "assign"),
    ...exceptions.filter(task => task.name !== "assign" && task.name !== "close"),
    ...exceptions.filter(task => task.name === "close"),
  ];
  return <>
    <section className={panelClass}><h2>{sale.brand === "BAAN_KUNAPAP" && sale.can_finance ? "ข้อมูลลูกค้าและโครงการ" : "ข้อมูลงาน"}</h2><dl className={factsClass}>
      <div><dt>ผู้รับผิดชอบงาน/รายการขาย</dt><dd>{sale.responsible_name}</dd></div><div><dt>เจ้าของ Lead ปัจจุบัน</dt><dd>{sale.lead_owner_name}</dd></div>
      {sale.can_finance && <>
        {sale.brand === "TARAVILLE" && <>
          <div><dt>แปลง/บ้าน</dt><dd>{sale.unit_label ?? "—"}</dd></div>
          <div><dt>ราคาขาย</dt><dd>{sale.list_price_cents != null ? `${formatMoney(sale.list_price_cents)} บาท` : "—"}</dd></div>
          <div><dt>ราคาสุทธิ</dt><dd>{sale.net_price_cents != null ? `${formatMoney(sale.net_price_cents)} บาท` : "—"}</dd></div>
        </>}
        <div><dt>โทรศัพท์ลูกค้า</dt><dd>{sale.customer_snapshot?.phone || "—"}</dd></div><div><dt>ที่อยู่ลูกค้า</dt><dd>{sale.customer_snapshot?.address || "—"}</dd></div>
      </>}
    </dl><p><Link href={`/leads/${sale.lead_id}`} prefetch={false}>เปิด Lead ต้นทาง</Link>{" "}<TaskLink data={data} name="edit-case" /></p></section>
    {houseBrief}
    {!sale.can_finance && <p className={noticeClass}>คุณดูข้อมูลงานได้ แต่ไม่มีสิทธิ์ดูเอกสารและข้อมูลการเงินของรายการนี้ ให้ผู้บริหารตรวจสอบสิทธิ์หากจำเป็นต้องใช้</p>}
    {work.length > 0 && <section className={panelClass}><h2>ตรวจรับงานก่อสร้าง</h2><ul className={sale.brand === "BAAN_KUNAPAP" ? ws.rows : "grid gap-3"}>
      {work.map(item => sale.brand === "BAAN_KUNAPAP" ? <li key={item.id} className={ws.card}>
        <div className={ws.rowHeading}><strong>งวดที่ {item.position}{item.progress_percent == null ? "" : ` · ความคืบหน้า ${item.progress_percent}%`}</strong>
          <Status tone={item.accepted ? "success" : "waiting"}>{item.accepted ? "ตรวจรับแล้ว" : "รอตรวจรับ"}</Status></div>
        <div className={ws.actions}><TaskLink data={data} name="acceptance" row={item.id} /></div>
      </li> : <li key={item.id}>งวดที่ {item.position}{item.progress_percent == null ? "" : ` · ความคืบหน้า ${item.progress_percent}%`} · {item.accepted ? "ตรวจรับแล้ว" : "รอตรวจรับ"}{" "}
        <TaskLink data={data} name="acceptance" row={item.id} /></li>)}</ul></section>}
    {managementTasks.length > 0 && <section className={panelClass} id="manage" aria-labelledby="manage-title">
      <h2 id="manage-title">{sale.brand === "BAAN_KUNAPAP" ? "จัดการโครงการ" : "จัดการรายการขาย"}</h2>
      <ul className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3 [&_li[data-close=true]]:col-span-full [&_li[data-close=true]_strong]:text-danger-ink">{managementTasks.map(task => {
        const action = managementActions[task.name];
        return <li key={task.name} data-close={task.name === "close"}>
          <Link className={cn(buttonVariants({ variant: "outline", size: "auto" }), "flex h-full w-full justify-between gap-3 px-4 py-3 hover:border-primary hover:bg-accent [&_strong]:block")} href={taskHref(sale.id, task.name)} prefetch={false}>
            <span><strong>{action?.title ?? task.label}</strong>
              {action && <span className="block mt-1 text-sm font-normal text-muted-foreground">{action.description}</span>}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>;
      })}</ul>
    </section>}
  </>;
}

export function DocumentsSection({ data }: { data: SummaryData }) {
  const { sale, finance, agreement } = data;
  if (!finance || !agreement) return null;
  if (sale.brand === "BAAN_KUNAPAP") return <BkpDocuments data={data} />;
  const summaries = finance.documents.filter(doc => doc.kind === "summary");
  const history = agreement.documents.filter(doc => doc.kind === "amendment" || doc.kind === "closeout");
  return <>
    {sale.brand === "TARAVILLE" && <section className={panelClass} id="summary"><h2>สรุปการจองและสัญญาขาย</h2>
      {!summaries.length && <p className="text-sm text-muted-foreground">ยังไม่มีสรุปการจอง</p>}
      {summaries.map(doc => <p key={doc.id}><Link href={`/sales/documents/${doc.id}`} prefetch={false}>สรุปการจอง {doc.number} · {formatDate(doc.document_date)}</Link></p>)}
      {finance.documents.filter(doc => doc.kind === "contract").map(doc => <p key={doc.id}><Link href={`/sales/documents/${doc.id}`} prefetch={false}>สัญญาขาย {doc.number}</Link></p>)}
      <p><TaskLink data={data} name="booking-summary" /> <TaskLink data={data} name="sign-property-contract" /></p>
    </section>}
    {history.length > 0 && <section className={panelClass}><h2>ข้อตกลงแก้ไขและปิดงาน</h2>
      {history.map(doc => <p key={doc.id}><Link href={`/sales/documents/${doc.id}`} prefetch={false}>{doc.kind === "amendment" ? "ข้อตกลงแก้ไข" : "ข้อตกลงปิดงาน"} {doc.number}</Link></p>)}</section>}
  </>;
}

export function MoneySection({ data }: { data: SummaryData }) {
  const { sale, finance, agreement, closeout, refunds } = data;
  if (!finance || !agreement) return null;
  const rows = agreement.instalments.filter(row => row.is_active).sort((a, b) => a.position - b.position);
  const receiptCount = finance.documents.filter(doc => doc.kind === "receipt").length;
  return <>
    {!finance.issuer_ready && <p className={noticeClass}>ยังไม่ได้ตั้งค่าบริษัทผู้ออกเอกสาร ให้ผู้บริหารตั้งค่าก่อนยืนยันรับเงินและออกใบเสร็จ</p>}
    <PendingPayments data={data} payments={finance.pending} />
    {rows.length > 0 && <section className={panelClass} id="schedule"><h2>งวดชำระตามสัญญา</h2>
      <ul className="grid gap-3">{rows.map(row => <li key={row.id}>
        <p><strong>{row.label}</strong> · สุทธิ {formatMoney(row.net_cents)} บาท{row.balance ? row.balance.outstanding_cents === "0" ? " · ครบยอดแล้ว" : ` · ค้าง ${formatMoney(row.balance.outstanding_cents)} บาท` : ""}</p>
        <p className="text-sm text-muted-foreground">ยอดงวด {formatMoney(row.gross_cents)} · หักเงินที่รับไว้ {formatMoney(row.credit_cents)} · {row.needs_acceptance ? row.accepted_at ? "ตรวจรับและลูกค้ายอมรับแล้ว" : "รอตรวจรับงานและหลักฐานลูกค้ายอมรับ" : "เงินมัดจำวันเซ็น ไม่ต้องตรวจรับงานก่อสร้าง"}</p>
        {row.balance && <p className="text-sm text-muted-foreground">รับจัดสรรแล้ว {formatMoney(row.balance.allocated_cents)} · คงเหลือ {formatMoney(row.balance.outstanding_cents)} บาท</p>}
        {row.invoice_document_id && <p><Link href={`/sales/documents/${row.invoice_document_id}`} prefetch={false}>เปิดใบแจ้งชำระ / สรุปเครดิต</Link></p>}
        <p><TaskLink data={data} name="acceptance" row={row.id} /> <TaskLink data={data} name="issue-invoice" row={row.id} /> <TaskLink data={data} name="prepare-instalment" row={row.id} /></p>
      </li>)}</ul>
      {sale.status === "contracted" && agreement.is_settled && <p className={noticeClass}>ชำระครบทุกงวดตามสัญญาแล้ว</p>}
    </section>}
    {findTask(data.tasks, "prepare-payment", undefined) && <section className={panelClass} id="prepare"><h2>บันทึกเงินเข้า</h2><p><TaskLink data={data} name="prepare-payment" /></p></section>}
    <details className={moneyDisclosureClass} open><summary>ประวัติใบเสร็จรับเงิน ({receiptCount})</summary>
      {!finance.documents.some(doc => doc.kind === "receipt") && <p className="text-sm text-muted-foreground">ยังไม่มีใบเสร็จ</p>}
      <ul className="grid gap-3">{finance.documents.filter(doc => doc.kind === "receipt").map(doc => <li key={doc.id}>
        <Link href={`/sales/documents/${doc.id}`} prefetch={false}>{doc.number} · {formatDate(doc.document_date)} · {doc.amount_cents ? `${formatMoney(doc.amount_cents)} บาท` : "—"}{doc.state === "cancelled" ? " · ยกเลิก" : ""}</Link>{" "}
        <TaskLink data={data} name="fix-receipt" row={doc.id} /></li>)}</ul>
    </details>
    {closeout && <section className={panelClass}><h2>ยอดปิดงานปัจจุบัน</h2>
      <dl className={factsClass}>
        <div><dt>ยอดตามข้อตกลงปิดงาน</dt><dd>{formatMoney(closeout.retained_cents)} บาท</dd></div>
        <div><dt>รับสุทธิหลังหักยอดคืนแล้ว</dt><dd>{formatMoney(closeout.received_cents)} บาท</dd></div>
        <div><dt>ยังต้องรับ</dt><dd>{formatMoney(closeout.remaining_cents)} บาท</dd></div>
        <div><dt>ยังต้องคืน</dt><dd>{formatMoney(closeout.refund_due_cents)} บาท</dd></div>
      </dl>
      <Link href={`/sales/documents/${closeout.document_id}`} prefetch={false}>เปิดข้อตกลงปิดงาน</Link>
    </section>}
    {(finance.payments.length > 0 || refunds.length > 0) && <details className={moneyDisclosureClass} id="refunds" open><summary>คืนเงินจริง ({refunds.length})</summary>
      {!refunds.length && <p className="text-sm text-muted-foreground">ยังไม่มีคำขอคืนเงิน</p>}
      <ul className="grid gap-3">{refunds.map(refund => <li key={refund.id}>
        <p>{formatMoney(refund.amount_cents)} บาท · <Status tone={refundStates[refund.state].tone}>{refundStates[refund.state].label}</Status> · {refund.requested_by_name}</p>
        <p className="text-sm text-muted-foreground">{refund.reason}{refund.decision_note ? ` · ผลพิจารณา: ${refund.decision_note}` : ""}</p>
        {refund.document_id && <p><Link href={`/sales/documents/${refund.document_id}`} prefetch={false}>เปิดเอกสารจ่ายคืน</Link></p>}
        <p><TaskLink data={data} name="decide-refund" row={refund.id} /> <TaskLink data={data} name="pay-refund" row={refund.id} /></p>
      </li>)}</ul>
      <p><TaskLink data={data} name="request-refund" /></p>
    </details>}
  </>;
}
