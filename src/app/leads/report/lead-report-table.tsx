"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BrandTag } from "@/components/brand-tag";
import { DataRow, DataTable, RowLink } from "@/components/data-table";
import { Status } from "@/components/status";
import { STAGE_GROUP_TONES, stageGroupLabel, stageGroupOf } from "@/lib/walkin/lead-stage";
import { sortLeads, thaiDate, type MonthlyReport } from "@/lib/walkin/monthly-report";
import styles from "./report.module.css";

type SortKey = "date" | "name";
type Props = { leads: MonthlyReport["leads"]; isSale: boolean; hasFilter: boolean; clearHref: string };

const full = "@max-[768px]/data-table:basis-full";

function SortButton({ isActive, isAscending, onSort, children }: { isActive: boolean; isAscending: boolean; onSort: () => void; children: ReactNode }) {
  return <th scope="col" aria-sort={isActive ? (isAscending ? "ascending" : "descending") : undefined}>
    <button type="button" onClick={onSort} className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
      {children} <span aria-hidden="true">{isActive ? (isAscending ? "↑" : "↓") : "↕"}</span>
    </button>
  </th>;
}

export function LeadReportTable({ leads, isSale, hasFilter, clearHref }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; isAscending: boolean }>({ key: "date", isAscending: false });
  const rows = sortLeads(leads, sort.key, sort.isAscending);
  const flip = (key: SortKey) => setSort(current => ({ key, isAscending: current.key === key ? !current.isAscending : key === "name" }));
  const emptyTitle = hasFilter ? "ไม่มี Lead ตามตัวกรองในเดือนนี้" : isSale ? "เดือนนี้ยังไม่มี Lead ที่คุณดูแล" : "ไม่มี Lead ที่ลงทะเบียนในเดือนนี้";

  return <section className={`grid gap-2 ${styles.noPrint}`} aria-labelledby="report-list-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="report-list-title" className="m-0 text-md font-bold">{isSale ? "รายชื่อของฉัน" : "รายชื่อ"} ({rows.length.toLocaleString("th-TH")})</h2>
      <span className="text-sm text-muted-foreground">เรียงตามวันที่ลงทะเบียนล่าสุดก่อน · กดหัวคอลัมน์เพื่อเรียงใหม่</span>
    </div>
    {rows.length === 0 ? <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-8 text-center text-muted-foreground">
      <strong className="text-foreground">{emptyTitle}</strong>
      <span>{hasFilter ? "ลองล้างตัวกรอง หรือเลือกเดือนอื่น" : "ลองเลือกเดือนอื่น"}</span>
      {hasFilter && <Link className="inline-flex min-h-10 items-center rounded-sm border px-3.5 font-semibold no-underline" href={clearHref} prefetch={false}>ล้างตัวกรอง</Link>}
    </div> : <>
      <DataTable label="รายชื่อ Lead ประจำเดือน">
        <thead><tr>
          <SortButton isActive={sort.key === "date"} isAscending={sort.isAscending} onSort={() => flip("date")}>วันที่ลงทะเบียน</SortButton>
          <SortButton isActive={sort.key === "name"} isAscending={sort.isAscending} onSort={() => flip("name")}>ชื่อ</SortButton>
          <th scope="col">เบอร์โทร</th><th scope="col">แบรนด์</th><th scope="col">ขั้น</th>
          {!isSale && <th scope="col">ผู้ดูแล</th>}
        </tr></thead>
        <tbody>{rows.map(lead => <DataRow key={lead.id}>
          <td className={`whitespace-nowrap tabular-nums ${full}`}><time dateTime={lead.created_at}>{thaiDate(lead.created_at)}</time></td>
          <td className={full}><RowLink className="font-semibold text-foreground" href={`/leads/${lead.id}`}>{lead.name}</RowLink></td>
          <td className="whitespace-nowrap tabular-nums">{lead.phone}</td>
          <td><BrandTag brand={lead.brand} /></td>
          <td><Status tone={STAGE_GROUP_TONES[stageGroupOf(lead.stage)]}>{stageGroupLabel(lead.stage)}</Status></td>
          {!isSale && <td className={`whitespace-nowrap ${full}`}>{lead.owner}</td>}
        </DataRow>)}</tbody>
      </DataTable>
      <p className="m-0 flex flex-wrap justify-between gap-3 text-sm text-muted-foreground"><span>ทั้งหมด {rows.length.toLocaleString("th-TH")} ราย</span><span>กดชื่อเพื่อเปิดรายละเอียด Lead</span></p>
    </>}
  </section>;
}
