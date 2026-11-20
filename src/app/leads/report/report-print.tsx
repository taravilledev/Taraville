"use client";

import { useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Notice } from "@/components/notice";
import { stageGroupLabel } from "@/lib/walkin/lead-stage";
import { REPORT_BRAND_LABELS, sortLeads, summarizeSelectedLeads, thaiDate, type MonthlyReport } from "@/lib/walkin/monthly-report";
import styles from "./report.module.css";

type Props = {
  leads: MonthlyReport["leads"];
  title: string;
  scope: string;
  preparedBy: string;
  brand?: keyof typeof REPORT_BRAND_LABELS;
  filterLines: string[];
  children: ReactNode;
};

const count = (value: number) => value.toLocaleString("th-TH");

// Prints every filtered row unless a few are picked; the paper summary is computed from the printed rows only.
// The page keys this component by the filters, so a new filter starts with nothing picked.
export function ReportPrint({ leads, title, scope, preparedBy, brand, filterLines, children }: Props) {
  const [isPicking, setIsPicking] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const printed = sortLeads(picked.size ? leads.filter(lead => picked.has(lead.id)) : leads, "date", false);
  const summary = summarizeSelectedLeads(printed);
  const brands = brand ? [brand] : (Object.keys(REPORT_BRAND_LABELS) as (keyof typeof REPORT_BRAND_LABELS)[]);

  function toggle(id: string, isChecked: boolean) {
    setPicked(current => {
      const next = new Set(current);
      if (isChecked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return <>
    <header className={`flex flex-wrap items-end justify-between gap-3 ${styles.noPrint}`}>
      {children}
      <Dialog>
        <DialogTrigger className={buttonVariants({ variant: "outline", size: "auto" })}><Printer size={16} aria-hidden="true" />พิมพ์ / PDF</DialogTrigger>
        <DialogContent title="พิมพ์ / PDF" className={styles.noPrint}>
          {printed.length === 0
            ? <Notice role="note">ไม่มีรายชื่อตามตัวกรองในเดือนนี้ จึงยังพิมพ์ไม่ได้ · ลองเลือกเดือนอื่นหรือล้างตัวกรองก่อน</Notice>
            : <>
              <p className="m-0">พิมพ์ <strong>{count(printed.length)} ราย</strong> {picked.size ? "ที่เลือก" : "ตามตัวกรองตอนนี้"} · สรุปบนกระดาษนับจากรายชื่อที่พิมพ์</p>
              <ul className="m-0 flex flex-col gap-1 rounded-sm bg-secondary py-2.5 pr-3 pl-7 text-sm">{filterLines.map(line => <li key={line}>{line}</li>)}</ul>
              <button type="button" aria-expanded={isPicking} onClick={() => setIsPicking(open => !open)}
                className="min-h-10 self-start border-0 bg-transparent p-0 font-semibold text-primary hover:underline">
                {isPicking ? (picked.size ? `เลือกไว้ ${count(picked.size)} ราย · ซ่อนรายการ` : "ซ่อนรายการ") : "เลือกเฉพาะบางราย…"}
              </button>
              {isPicking && <div className="flex max-h-56 flex-col overflow-y-auto rounded-sm border">
                {sortLeads(leads, "date", false).map(lead => <label key={lead.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b px-3 last:border-b-0">
                  <input type="checkbox" className="size-4.5 accent-primary" checked={picked.has(lead.id)} onChange={event => toggle(lead.id, event.currentTarget.checked)} />
                  {lead.name} · <span className="text-muted-foreground">{thaiDate(lead.created_at)}</span>
                </label>)}
              </div>}
            </>}
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">ยกเลิก</Button></DialogClose>
            {printed.length > 0 && <Button type="button" onClick={event => { event.currentTarget.closest("dialog")?.close(); window.print(); }}>พิมพ์</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </header>
    <section className={styles.paperHeading} aria-label="รายงานสำหรับพิมพ์">
      <p className={styles.company}>Taraville Group</p>
      <h1>{title}{brand && ` · ${REPORT_BRAND_LABELS[brand]}`}</h1>
      <p>{scope}</p>
      <p>วันที่จัดทำ {preparedBy}</p>
      <h2>สรุปจากรายชื่อที่พิมพ์</h2>
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
      <p>นับตามสถานะล่าสุดของโครงการที่ผูกกับรายชื่อที่พิมพ์ · ปิดโครงการรวมงานที่เสร็จแล้วและยกเลิก</p>
      {brands.some(item => !summary.byBrand[item].hasProjectCounts) && <p>ยังไม่มีข้อมูลยอดโครงการสำหรับรายงานนี้</p>}
      <h2>รายชื่อที่พิมพ์ ({count(printed.length)} ราย)</h2>
      <table className={styles.paperList}>
        <thead><tr><th scope="col">วันที่</th><th scope="col">ชื่อ</th><th scope="col">เบอร์โทร</th><th scope="col">แบรนด์</th><th scope="col">ขั้น</th><th scope="col">ผู้ดูแล</th></tr></thead>
        <tbody>{printed.map(lead => <tr key={lead.id}>
          <td>{thaiDate(lead.created_at)}</td><td>{lead.name}</td><td>{lead.phone}</td>
          <td>{REPORT_BRAND_LABELS[lead.brand]}</td><td>{stageGroupLabel(lead.stage)}</td><td>{lead.owner}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </>;
}
