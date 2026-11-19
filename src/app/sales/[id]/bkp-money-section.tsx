import Link from "next/link";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { findTask, taskHref } from "@/lib/sales/tasks";
import { collectionRows, collectionSummary } from "@/lib/sales/finance-collection";
import type { SummaryData } from "./summary-sections";
import { WorkspaceHeading } from "./workspace-heading";
import { PendingPayments } from "./pending-payments";
import { FinanceCollection } from "./finance-collection";
import * as ws from "./workspace-styles";
import * as local from "./finance-collection-styles";
import { noticeClass } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";

const refundStates = { pending: "รออนุมัติ", approved: "อนุมัติ รอจ่าย", rejected: "ไม่อนุมัติ", withdrawn: "ถอนคำขอ", paid: "จ่ายคืนแล้ว" };

export function BkpMoneySection({ data }: { data: SummaryData }) {
  const { sale, finance, agreement, summary, closeout, refunds, tasks } = data;
  if (!finance || !agreement) return null;
  const isClosed = sale.status === "cancelled";
  const totals = collectionSummary(finance, agreement, summary?.received, isClosed ? closeout?.remaining_cents : undefined, isClosed);
  const rows = collectionRows(sale.id, finance, agreement, tasks, isClosed);
  const hasLegacyDesign = finance.design_legacy_has_payments || BigInt(finance.design_legacy_received_cents) > BigInt(0);
  const amount = (value: string | null) => value === null ? "ยังไม่ระบุ" : `${formatMoney(value)} บาท`;
  const receipts = finance.documents.filter(doc => doc.kind === "receipt");
  const corrections = receipts.filter(doc => findTask(tasks, "fix-receipt", doc.id));
  const prepare = findTask(tasks, "prepare-payment", undefined);
  const requestRefund = findTask(tasks, "request-refund", undefined);
  const activeRefunds = refunds.filter(refund => ["pending", "approved"].includes(refund.state));
  return <section className={ws.section} aria-label="การเงิน">
    <WorkspaceHeading caseId={sale.id} title="การเงิน" description="บิล เงินรอยืนยัน และการรับชำระค่าแบบกับงวดสัญญาในที่เดียว" />
    <dl className={local.summary}>
      <div><dt>รับจริงสุทธิทั้งโครงการ</dt><dd>{amount(totals.received)}</dd></div>
      <div><dt>เงินเข้ารอยืนยัน</dt><dd>{amount(totals.pending)}</dd></div>
      <div><dt>{isClosed ? "ข้อมูลค่าแบบก่อนปิดงาน" : totals.isDesignIncluded ? "ค่าออกแบบ" : "ค่าแบบคงเหลือ"}</dt><dd>{isClosed ? "ดูรายการอ้างอิงด้านล่าง" : totals.isDesignIncluded ? "รวมในราคาสัญญาแล้ว" : totals.designRemaining === null ? "ยังไม่กำหนดค่าออกแบบ" : amount(totals.designRemaining)}</dd></div>
      <div><dt>{isClosed ? "ยอดคงเหลือตามปิดงาน" : "งวดสัญญาคงเหลือ"}</dt><dd>{totals.contractRemaining === null ? isClosed ? "ยังไม่มีสรุปปิดงาน" : "ยังไม่มีงวดตามสัญญา" : amount(totals.contractRemaining)}</dd></div>
    </dl>
    <p className={ws.note}>ยอดรับจริงสุทธิรวมค่าแบบที่รับแล้วเพียงครั้งเดียว · เงินรอยืนยันยังไม่ใช่ยอดรับจริง · เครดิตไม่ใช่เงินเข้าใหม่</p>
    {isClosed && <p className={noticeClass}>โครงการนี้ยกเลิกแล้ว รายการค่าแบบและงวดเดิมด้านล่างใช้สำหรับอ้างอิง ยอดที่ยังต้องรับยึดตามสรุปปิดงาน</p>}
    {!finance.issuer_ready && <p className={noticeClass}>ยังไม่ได้ตั้งค่าบริษัทผู้ออกเอกสาร ให้ผู้บริหารตั้งค่าก่อนยืนยันรับเงินและออกใบเสร็จ</p>}
    {totals.isDesignIncluded && finance.pending.some(payment => payment.kind === "design_fee") && <p className={noticeClass}>มีเงินค่าแบบที่เตรียมไว้ก่อนลงนาม ตรวจหลักฐานและยอดตามสัญญาก่อนยืนยัน เพื่อป้องกันการเรียกเก็บซ้ำ</p>}
    <PendingPayments data={data} payments={finance.pending} />
    {!finance.pending.length && <p id="pending" className={ws.note}>ไม่มีรายการรับเงินรอยืนยัน</p>}
    {hasLegacyDesign && <p className={noticeClass}>ยอดรับจริงรวมเงินค่าแบบเดิมแล้ว แต่ยังไม่ระบุว่าชำระบิลใด กรุณาตรวจประวัติรับเงินก่อนเรียกเก็บซ้ำ</p>}
    <FinanceCollection rows={rows} caseId={sale.id} isClosed={isClosed} />
    {sale.status === "contracted" && agreement.is_settled && <p className={noticeClass}>ชำระครบทุกงวดตามสัญญาแล้ว</p>}
    <div className={ws.card} id="prepare"><div><h3>เงินเข้าอื่นของโครงการ</h3><p className={ws.note}>หากรับเงินตามรายการ ให้ใช้ปุ่มของรายการนั้นเพื่อผูกยอดให้ถูกต้อง</p></div>
      {prepare ? <div className={ws.actions}><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={taskHref(sale.id, prepare.name)} prefetch={false}>บันทึกเงินเข้าอื่น</Link></div>
        : <p className={ws.note}>ยังไม่มีงานบันทึกเงินเข้าอื่นที่บัญชีนี้ทำได้</p>}</div>
    <details className={ws.history} id="receipts" open={corrections.length > 0 || undefined}><summary>ประวัติใบเสร็จรับเงิน ({receipts.length}){corrections.length > 0 ? ` · แก้ไขเอกสารได้ ${corrections.length} รายการ` : ""}</summary>
      {!receipts.length && <p className={ws.note}>ยังไม่มีใบเสร็จ</p>}
      <ul>{receipts.map(doc => { const correct = findTask(tasks, "fix-receipt", doc.id); return <li key={doc.id}>
        <div><Link href={`/sales/documents/${doc.id}`} prefetch={false}>{doc.number ?? "ใบเสร็จ"}</Link>
          <p>{formatDate(doc.document_date)} · {doc.amount_cents ? `${formatMoney(doc.amount_cents)} บาท` : "ยังไม่ระบุยอด"} · {doc.state === "cancelled" ? "ยกเลิกแล้ว" : "ออกใบเสร็จแล้ว"}</p></div>
        {correct && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={taskHref(sale.id, correct.name, correct.row)} prefetch={false}>แก้ไขใบเสร็จ</Link>}
      </li>; })}</ul>
    </details>
    {closeout && <div className={ws.card}><h3>ยอดปิดงานปัจจุบัน</h3><dl className={ws.facts}>
      <div><dt>ยอดตามข้อตกลงปิดงาน</dt><dd>{formatMoney(closeout.retained_cents)} บาท</dd></div>
      <div><dt>รับสุทธิหลังหักยอดคืนแล้ว</dt><dd>{formatMoney(closeout.received_cents)} บาท</dd></div>
      <div><dt>ยังต้องรับ</dt><dd>{formatMoney(closeout.remaining_cents)} บาท</dd></div>
      <div><dt>ยังต้องคืน</dt><dd>{formatMoney(closeout.refund_due_cents)} บาท</dd></div>
    </dl><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/documents/${closeout.document_id}`} prefetch={false}>เปิดข้อตกลงปิดงาน</Link></div>}
    <details className={ws.history} id="refunds" open={activeRefunds.length > 0 || undefined}>
      <summary>คืนเงินจริง ({refunds.length}){activeRefunds.length > 0 ? ` · รอดำเนินการ ${activeRefunds.length} รายการ` : ""}</summary>
      {!refunds.length && <p className={ws.note}>ยังไม่มีคำขอคืนเงิน</p>}
      <ul>{refunds.map(refund => {
        const decide = findTask(tasks, "decide-refund", refund.id); const pay = findTask(tasks, "pay-refund", refund.id);
        return <li key={refund.id}><div><strong>{formatMoney(refund.amount_cents)} บาท · {refundStates[refund.state]}</strong>
          <p>{refund.requested_by_name} · {refund.reason}{refund.decision_note ? ` · ผลพิจารณา: ${refund.decision_note}` : ""}</p></div>
          <div className={ws.actions}>
            {decide && <Link className={buttonVariants({ size: "auto" })} href={taskHref(sale.id, decide.name, decide.row)} prefetch={false}>พิจารณาคืนเงิน</Link>}
            {pay && <Link className={buttonVariants({ size: "auto" })} href={taskHref(sale.id, pay.name, pay.row)} prefetch={false}>บันทึกจ่ายคืน</Link>}
            {refund.document_id && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/documents/${refund.document_id}`} prefetch={false}>เปิดเอกสารจ่ายคืน</Link>}
          </div></li>;
      })}</ul>
      {requestRefund && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={taskHref(sale.id, requestRefund.name)} prefetch={false}>ขอคืนเงิน</Link>}
    </details>
  </section>;
}
