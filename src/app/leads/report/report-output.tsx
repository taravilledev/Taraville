"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { STAGE_LABELS } from "@/lib/walkin/lead-stage";
import { REPORT_BRAND_LABELS, summarizeSelectedLeads, type MonthlyReport } from "@/lib/walkin/monthly-report";
import { ReportControls } from "./report-controls";
import styles from "./report.module.css";

type Props = {
  filterKey: string;
  filters: ComponentProps<typeof ReportControls>;
  leads: MonthlyReport["leads"];
  title: string;
  scope: string;
  preparedBy: string;
  children: ReactNode;
};

const count = (value: number) => value.toLocaleString("th-TH");

export function ReportOutput({ filterKey, filters, leads, title, scope, preparedBy, children }: Props) {
  const defaultSelection = () => new Set(leads.filter(lead => !lead.is_synthetic).map(lead => lead.id));
  const [selection, setSelection] = useState(() => ({ filterKey, ids: defaultSelection() }));
  if (selection.filterKey !== filterKey) setSelection({ filterKey, ids: defaultSelection() });
  const selected = selection.ids;
  const picked = leads.filter(lead => selected.has(lead.id));
  const summary = summarizeSelectedLeads(picked);
  const brand = filters.brand;
  const brands = brand ? [brand] : Object.keys(REPORT_BRAND_LABELS) as (keyof typeof REPORT_BRAND_LABELS)[];
  const allSelected = leads.length > 0 && picked.length === leads.length;

  function toggle(id: string, checked: boolean) {
    setSelection(current => {
      const next = new Set(current.ids);
      if (checked) next.add(id);
      else next.delete(id);
      return { filterKey, ids: next };
    });
  }

  return <>
    <ReportControls {...filters} printDisabled={picked.length === 0} />
    <div className={styles.noPrint}>{children}</div>
    <section className={styles.paperHeading} aria-label="สรุปรายงานสำหรับพิมพ์">
      <p className={styles.company}>Taraville Group</p>
      <h1>{title}{brand && ` · ${REPORT_BRAND_LABELS[brand]}`}</h1>
      <p>{scope}</p>
      <p>วันที่จัดทำ {preparedBy}</p>
      <h2>สรุปจากรายชื่อที่เลือก</h2>
      <table className={styles.paperTotals}>
        <thead><tr><th scope="col">แบรนด์</th><th scope="col">Lead ใหม่ (ราย)</th><th scope="col">โครงการเปิดอยู่</th><th scope="col">ปิดโครงการ</th></tr></thead>
        <tbody>{brands.map(item => {
          const totals = summary.byBrand[item];
          return <tr key={item}><th scope="row">{REPORT_BRAND_LABELS[item]}</th>
            <td>{count(totals.total)}</td>
            <td>{totals.hasProjectCounts ? count(totals.open) : "—"}</td>
            <td>{totals.hasProjectCounts ? count(totals.closed) : "—"}</td></tr>;
        })}</tbody>
      </table>
      <p>นับตามสถานะล่าสุดของโครงการที่ผูกกับรายชื่อที่เลือก · ปิดโครงการรวมงานที่เสร็จแล้วและยกเลิก</p>
      {brands.some(item => !summary.byBrand[item].hasProjectCounts) && <p>ยังไม่มีข้อมูลยอดโครงการสำหรับรายงานนี้</p>}
      {summary.synthetic > 0 && <p>มีข้อมูลสมมติ {count(summary.synthetic)} รายในตาราง ยอดสรุปนับเฉพาะข้อมูลจริง</p>}
      <h2>รายชื่อที่เลือก ({count(picked.length)} ราย)</h2>
    </section>
    <div className={`${styles.selectionBar} ${styles.noPrint}`}>
      <h2>รายชื่อ ({count(leads.length)})</h2>
      {leads.length > 0 && <>
        <span role="status">เลือกพิมพ์ {count(picked.length)} จาก {count(leads.length)} ราย</span>
        <button type="button" className={styles.print} onClick={() => setSelection({ filterKey, ids: new Set(allSelected ? [] : leads.map(lead => lead.id)) })}>
          {allSelected ? "ยกเลิกการเลือกทั้งหมด" : "เลือกทั้งหมดสำหรับพิมพ์"}
        </button>
      </>}
    </div>
    {leads.length ? <table className={styles.table}>
      <thead><tr><th className={styles.noPrint} scope="col">เลือกพิมพ์</th><th scope="col">วันที่</th><th scope="col">ชื่อ</th><th scope="col">เบอร์โทร</th><th scope="col">แบรนด์</th><th scope="col">สถานะ</th><th scope="col">ผู้ดูแล</th></tr></thead>
      <tbody>{leads.map(lead => <tr key={lead.id} data-print={selected.has(lead.id)}>
        <td className={styles.noPrint}><input type="checkbox" aria-label={`เลือกพิมพ์ ${lead.name}`} checked={selected.has(lead.id)}
          onChange={event => toggle(lead.id, event.currentTarget.checked)} /></td>
        <td>{new Date(lead.created_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</td>
        <td>{lead.name}{lead.is_synthetic && <small> · ข้อมูลสมมติ</small>}</td>
        <td>{lead.phone}</td><td>{REPORT_BRAND_LABELS[lead.brand]}</td><td>{STAGE_LABELS[lead.stage]}</td><td>{lead.owner}</td>
      </tr>)}</tbody>
    </table> : <p className={`${styles.empty} ${styles.noPrint}`}>ไม่มี Lead ที่ลงทะเบียนในเดือนนี้</p>}
  </>;
}
