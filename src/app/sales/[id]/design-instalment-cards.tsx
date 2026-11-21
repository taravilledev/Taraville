import Link from "next/link";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import { collectionRows, type CollectionRow } from "@/lib/sales/finance-collection";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import { formatDate } from "@/lib/sales/date";
import { formatMoney } from "@/lib/sales/money";
import type { Task } from "@/lib/sales/tasks";
import * as ws from "./workspace-styles";
import { Status, type StatusTone } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";

const titles = ["แบบแปลน", "3D", "ครบทุกรายการ"];
const dueNotes = ["เก็บเมื่อส่งมอบแบบแปลน", "เก็บเมื่อส่งมอบ 3D", "เก็บเมื่อส่งมอบครบ"];
const tones: Record<string, StatusTone> = { "รับครบแล้ว": "success", "รอชำระ": "progress", "ยังไม่ออกบิล": "inactive", "รวมในราคาสัญญาแล้ว": "inactive" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const hasBill = (row: CollectionRow) => row.links.some(link => link.label === "ดูบิล");
const isUnpaid = (row: CollectionRow) => (row.status === "รอชำระ" || row.status === "รอยืนยันรับเงิน") && !row.isReference && row.outstandingCents !== null;

/** Board wording on top of the collection row, which stays the source of truth for state, actions and links. */
function Card({ row, position, isActive, isLater }: { row: CollectionRow; position: number; isActive: boolean; isLater: boolean }) {
  const isOverdue = row.status === "รอชำระ" && !!row.dueDate && row.dueDate < today();
  const label = isOverdue ? "เกินกำหนดชำระ" : row.status === "รอชำระ" && row.dueDate ? `ออกใบแจ้งชำระแล้ว · ครบกำหนด ${formatDate(row.dueDate)}`
    : isActive ? "รอส่งมอบ" : isLater ? "ยังไม่ถึงงวด" : row.status;
  const tone = isOverdue ? "fix" : isActive ? "waiting" : tones[row.status] ?? "waiting";
  const link = (item: { label: string; href: string }, primary = false) => <Link key={item.href + item.label} className={buttonVariants({ variant: primary ? "default" : "outline", size: "auto" })}
    href={item.href} prefetch={false}>{primary && item.label === "ออกใบแจ้งชำระ" ? "ส่งมอบแล้ว · ออกใบแจ้งชำระ" : item.label}</Link>;
  return <li className={`${ws.card} content-start ${isActive || hasBill(row) ? ws.current : ""}`}>
    <strong>งวด {position}/3 · {titles[position - 1]}</strong>
    <span className="text-xl font-bold tabular-nums">{formatMoney(row.amountCents)} <small className="text-sm font-medium text-muted-foreground">บาท</small></span>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Status tone={tone}>{label}</Status>
      <span className="text-xs text-muted-foreground">{row.dueDate && !row.isReference ? `ครบกำหนด ${formatDate(row.dueDate)}` : dueNotes[position - 1]}</span></div>
    {isOverdue && <p className="text-sm text-danger-ink" role="status">เลยกำหนดชำระแล้ว · ติดตามลูกค้า (ไม่กระทบขั้นอื่น)</p>}
    <p className={ws.note}>{row.note}</p>
    {/* Board ProjectDesign: only the next instalment offers billing here; the money tab still lists every allowed bill. */}
    <div className={ws.actions}>{row.primaryAction && !isLater && link(row.primaryAction, true)}{row.links.map(item => link(item))}</div>
    {row.history.length > 0 && <details className="text-sm"><summary className="cursor-pointer py-1">ประวัติบิล ({row.history.length})</summary>
      <ul className="m-0 grid list-none gap-1 p-0">{row.history.map(item => <li key={item.href}><Link className="text-primary" href={item.href} prefetch={false}>{item.label}{item.cancelled ? " · ยกเลิกแล้ว" : ""}</Link></li>)}</ul></details>}
  </li>;
}

export function DesignInstalmentCards({ caseId, finance, agreement, tasks }: { caseId: string; finance: FinancialDetail; agreement: AgreementDetail; tasks: Task[] }) {
  const rows = collectionRows(caseId, finance, agreement, tasks).filter(row => row.group === "design");
  const unpaid = rows.filter(isUnpaid);
  const owed = unpaid.reduce((sum, row) => sum + BigInt(row.outstandingCents ?? "0"), BigInt(0));
  const overdue = unpaid.filter(row => row.status === "รอชำระ" && row.dueDate && row.dueDate < today()).length;
  const activeIndex = rows.findIndex(row => row.status === "ยังไม่ออกบิล" && !!row.primaryAction);
  return <>
    {unpaid.length > 0 && <p className={`${ws.note} text-foreground`} role="status"><strong>ค่าแบบค้าง {formatMoney(owed.toString())} บาท</strong> · {unpaid.length} งวดที่ออกใบแจ้งชำระแล้วและยังไม่ครบ{overdue > 0 ? ` · เกินกำหนด ${overdue} งวด` : ""}</p>}
    <ol className="m-0 grid list-none grid-cols-3 gap-3 p-0 max-[860px]:grid-cols-1" aria-label="งวดค่าออกแบบ">
      {rows.map((row, index) => {
        if (row.status === "ไม่มีเรียกเก็บ") return null;
        const isUnbilled = row.status === "ยังไม่ออกบิล";
        const isActive = index === activeIndex;
        const isLater = isUnbilled && activeIndex !== -1 && index > activeIndex;
        return <Card key={row.id} row={row} position={index + 1} isActive={isActive} isLater={isLater} />;
      })}
    </ol>
    <p className={ws.note}>“ครบทุกรายการ” = แบบขออนุญาตก่อสร้าง · BOQ · เอกสารยื่นธนาคาร · รายการคำนวณวิศวกร</p>
  </>;
}
