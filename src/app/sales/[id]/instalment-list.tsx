import Link from "next/link";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { findTask, taskHref } from "@/lib/sales/tasks";
import type { SummaryData } from "./summary-sections";
import shared from "../sales.module.css";
import styles from "./workspace-section.module.css";

export function InstalmentList({ data }: { data: SummaryData }) {
  const { sale, agreement, tasks } = data;
  if (!agreement) return null;
  const rows = agreement.instalments.filter(row => row.is_active).sort((a, b) => a.position - b.position);
  return <section className={styles.section} id="schedule" aria-labelledby="schedule-title">
    <div><h3 id="schedule-title">งวดชำระตามสัญญา</h3><p className={styles.note}>{rows.length ? `${rows.length} งวด · ตรวจรับงาน ออกบิล และบันทึกเงินแยกตามงวด` : "ตารางงวดจะแสดงหลังลงนามสัญญา"}</p></div>
    {!rows.length && <div className={styles.actions}><Link className={shared.link} href={`/sales/${sale.id}?tab=contract`} prefetch={false}>ไปสัญญา</Link></div>}
    <ol className={styles.rows}>{rows.map(row => {
      const isPaid = !!row.invoice_id && row.balance?.is_active === true && row.balance.outstanding_cents === "0";
      const isCreditOnly = row.net_cents === "0";
      const needsAcceptance = row.needs_acceptance && !row.accepted_at;
      const next = findTask(tasks, "acceptance", row.id) ?? findTask(tasks, "issue-invoice", row.id) ?? findTask(tasks, "prepare-instalment", row.id);
      const nextLabel = next?.name === "acceptance" ? "บันทึกผลตรวจรับงาน" : next?.name === "issue-invoice"
        ? isCreditOnly ? "บันทึกสรุปเครดิตงวดนี้" : "ออกใบแจ้งชำระ" : "บันทึกเงินเข้างวดนี้";
      const status = isPaid ? "ครบยอดแล้ว" : needsAcceptance ? "รอตรวจรับงาน" : row.invoice_id ? "รอรับชำระ" : isCreditOnly ? "รอบันทึกสรุปเครดิต" : "ยังไม่ออกบิล";
      return <li key={row.id} className={styles.card}>
        <div className={styles.rowHeading}><h3>{row.label}</h3><span className={styles.status} data-done={isPaid}>{status}</span></div>
        <dl className={styles.facts}>
          <div><dt>ยอดชำระงวดนี้</dt><dd className={styles.amount}>{formatMoney(row.net_cents)} บาท</dd></div>
          <div><dt>รับจัดสรรแล้ว</dt><dd>{row.balance ? `${formatMoney(row.balance.allocated_cents)} บาท` : "ยังไม่มีข้อมูลจัดสรร"}</dd></div>
          <div><dt>คงเหลือ</dt><dd>{row.balance ? `${formatMoney(row.balance.outstanding_cents)} บาท` : "ยังไม่มีข้อมูลยอดคงเหลือ"}</dd></div>
        </dl>
        <p className={styles.note}>ยอดงวด {formatMoney(row.gross_cents)} · หักเครดิตที่รับไว้ {formatMoney(row.credit_cents)} บาท</p>
        <p className={styles.note}>{row.needs_acceptance ? row.accepted_at ? "ตรวจรับและลูกค้ายอมรับแล้ว" : "ต้องมีผลตรวจรับงานและหลักฐานลูกค้ายอมรับก่อนออกบิล" : "เงินมัดจำวันลงนาม · ไม่ต้องตรวจรับงานก่อสร้าง"}
          {row.progress_percent != null ? ` · ความคืบหน้างาน ${row.progress_percent}%` : ""}</p>
        {(row.acceptance_date || row.due_date) && <dl className={styles.facts}>
          {row.acceptance_date && <div><dt>วันที่ตรวจรับจริง</dt><dd>{formatDate(row.acceptance_date)}</dd></div>}
          {row.due_date && <div><dt>ครบกำหนดชำระ</dt><dd>{formatDate(row.due_date)}</dd></div>}
        </dl>}
        <div className={styles.next}><div className={styles.actions}>
          {next && <Link className={shared.primary} href={taskHref(sale.id, next.name, next.row)} prefetch={false}>{nextLabel}</Link>}
          {row.invoice_document_id && <Link className={shared.link} href={`/sales/documents/${row.invoice_document_id}`} prefetch={false}>ดูใบแจ้งชำระ / เครดิต</Link>}
        </div>{!next && !isPaid && <p className={styles.note}>ยังไม่มีงานที่บัญชีนี้ทำต่อได้ · ตรวจรายการเงินรอยืนยันด้านบนหรือรอผู้มีสิทธิ์ดำเนินการ</p>}</div>
      </li>;
    })}</ol>
    {sale.status === "contracted" && agreement.is_settled && <p className={shared.notice}>ชำระครบทุกงวดตามสัญญาแล้ว</p>}
  </section>;
}
