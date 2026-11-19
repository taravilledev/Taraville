"use client";

import { useState } from "react";
import Link from "next/link";
import type { CollectionRow } from "@/lib/sales/finance-collection";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import * as styles from "./finance-collection-styles";
import { Status } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";

const filters = [
  { id: "all", label: "ทั้งหมด" }, { id: "ready", label: "รอออกบิล" }, { id: "payment", label: "รอชำระ / ยืนยัน" },
  { id: "acceptance", label: "รอตรวจรับ" }, { id: "complete", label: "ครบแล้ว" },
] as const;

function RowActions({ row }: { row: CollectionRow }) {
  if (!row.primaryAction && !row.links.length && !row.history.length) return <span className={styles.note}>
    {row.isReference ? "ดูเพื่ออ้างอิง" : row.filter === "complete" ? "ไม่มีงานค้าง" : "ยังดำเนินการไม่ได้ตามสถานะหรือสิทธิ์"}
  </span>;
  return <div className={styles.actions}>
    {row.primaryAction && <Link className={buttonVariants({ size: "auto" })} href={row.primaryAction.href} prefetch={false}>{row.primaryAction.label}</Link>}
    {row.links.map(link => <Link className={buttonVariants({ variant: "outline", size: "auto" })} key={link.href} href={link.href} prefetch={false}>{link.label}</Link>)}
    {row.history.length > 0 && <details className={styles.history}><summary>ประวัติบิล ({row.history.length})</summary>
      <ul>{row.history.map(link => <li key={link.href}><Link href={link.href} prefetch={false}>{link.label}{link.cancelled ? " · ยกเลิกแล้ว" : ""}</Link></li>)}</ul>
    </details>}
  </div>;
}
function RowDates({ row }: { row: CollectionRow }) {
  return <>{row.acceptanceDate && <span>ตรวจรับ {formatDate(row.acceptanceDate)}</span>}
    {row.dueDate && <span>ครบกำหนด {formatDate(row.dueDate)}</span>}
    {!row.acceptanceDate && !row.dueDate && <span>ยังไม่มีวันที่</span>}</>;
}
function RowStatus({ row }: { row: CollectionRow }) {
  return <Status tone={row.filter === "complete" ? "success" : row.filter ? "waiting" : "inactive"}>{row.status}</Status>;
}

function RowAmount({ row, isClosed }: { row: CollectionRow; isClosed: boolean }) {
  return <>{row.isReference && <small>{isClosed ? "ยอดเดิมก่อนปิดงาน" : "ยอดตามแพ็กเกจ"}</small>}<strong>{formatMoney(row.amountCents)} บาท</strong>
    <small>{row.isReference ? "ข้อมูลอ้างอิง ไม่ใช่ยอดเรียกเก็บปัจจุบัน" : `คงเหลือ ${row.outstandingCents === null ? "ยังไม่ระบุ" : `${formatMoney(row.outstandingCents)} บาท`}`}</small></>;
}

export function FinanceCollection({ rows, caseId, isClosed = false }: { rows: CollectionRow[]; caseId: string; isClosed?: boolean }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const matches = rows.filter(row => filter === "all" || row.filter === filter);
  return <section className={styles.collection} aria-labelledby="collection-title">
    <div className={styles.heading}><h3 id="collection-title">รายการเรียกเก็บและรับชำระ</h3><p>ค่าแบบและงวดสัญญาแยกกลุ่ม · เลือกทำงานจากแต่ละรายการ</p></div>
    <div className={styles.filters} role="group" aria-label="กรองสถานะรายการชำระ">{filters.map(item =>
      <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
        {item.label} <span>{item.id === "all" ? rows.length : rows.filter(row => row.filter === item.id).length}</span>
      </button>)}</div>
    <p className={styles.result} role="status">แสดง {matches.length} จาก {rows.length} รายการ</p>
    {([{ id: "design", anchor: "design-fees", title: "ค่าออกแบบ", empty: "ยังไม่มีแพ็กเกจค่าออกแบบ", tab: "design" },
      { id: "contract", anchor: "schedule", title: "งวดตามสัญญา", empty: "ตารางงวดจะแสดงหลังลงนามสัญญา", tab: "contract" }] as const).map(group => {
      const groupRows = matches.filter(row => row.group === group.id);
      return <section key={group.id} id={group.anchor} className={styles.group} aria-labelledby={`${group.id}-collection-title`}>
        <div className={styles.groupHeading}><h4 id={`${group.id}-collection-title`}>{group.title}{isClosed ? " · อ้างอิง" : ""} <span>({groupRows.length})</span></h4>
          <Link href={`/sales/${caseId}?tab=${group.tab}`} prefetch={false}>{group.id === "design" ? "ดูแพ็กเกจ" : "ดูสัญญา"} →</Link></div>
        {!groupRows.length ? <p className={styles.empty}>{rows.some(row => row.group === group.id) ? "ไม่มีรายการในสถานะที่เลือก" : isClosed ? "ไม่มีรายการอ้างอิงในหมวดนี้" : group.empty}</p> : <>
          <table className={styles.table}><caption className={styles.srOnly}>{group.title}</caption>
            <thead><tr><th scope="col">รายการ</th><th scope="col">ยอด / คงเหลือ</th><th scope="col">สถานะ</th>
              <th scope="col">{group.id === "design" ? "วันครบกำหนด" : "วันสำคัญ"}</th><th scope="col">ดำเนินการ</th></tr></thead>
            <tbody>{groupRows.map(row => <tr key={row.id}>
              <th scope="row"><strong>{row.label}</strong><small>{row.note}</small></th>
              <td className={styles.amount}><RowAmount row={row} isClosed={isClosed} /></td>
              <td><RowStatus row={row} /></td>
              <td className={styles.dates}><RowDates row={row} /></td><td><RowActions row={row} /></td>
            </tr>)}</tbody>
          </table>
          <ul className={styles.mobileCards}>{groupRows.map(row => <li key={row.id}>
            <div className={styles.cardHeading}><h5>{row.label}</h5><RowStatus row={row} /></div>
            <div className={styles.amount}><RowAmount row={row} isClosed={isClosed} /></div><p className={styles.note}>{row.note}</p>
            <div className={styles.dates}><RowDates row={row} /></div><RowActions row={row} />
          </li>)}</ul>
        </>}
      </section>;
    })}
  </section>;
}
