"use client";

import { nativeDialogClass, nativeDialogHeaderClass, nativeDialogBodyClass } from "@/components/native-dialog-styles";
import { useId, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { toast } from "sonner";
import { ProjectTable } from "./project-table";
import {
  amountState, collectionFilters, displayAmount, filterSummaryReportRows, selectSummaryReport, summaryCsv,
  summaryStages, updateSummarySelection, type SummaryReport,
} from "./summary-model";
import * as styles from "./summary-styles";
import paper from "./summary-print.module.css";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export function ReportOutputDialog({ report, title, today }: { report: SummaryReport; title: string; today: string }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"csv" | "print">("print");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [filters, setFilters] = useState({ query: "", stage: "", money: "" });
  const [printReport, setPrintReport] = useState<SummaryReport | null>(null);
  const chosen = selectSummaryReport(report, selected);
  const count = chosen.rows.length;
  const visible = filterSummaryReportRows(report.rows, filters);
  const visibleSelectedCount = visible.filter(row => selected.has(row.id)).length;
  const hiddenSelectedCount = count - visibleSelectedCount;
  const isAllSelected = visible.length > 0 && visibleSelectedCount === visible.length;

  function open(next: typeof mode) {
    setMode(next);
    setPrintReport(null);
    dialog.current?.showModal();
  }

  function exportSelection() {
    if (!count) return;
    if (mode === "csv") {
      const url = URL.createObjectURL(new Blob([summaryCsv(chosen, true)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `bkp-project-summary-${today}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      dialog.current?.close();
      toast.success("เริ่มดาวน์โหลดรายงาน CSV แล้ว");
      return;
    }
    dialog.current?.close();
    flushSync(() => setPrintReport(chosen));
    window.addEventListener("afterprint", () => setPrintReport(null), { once: true });
    window.print();
  }

  return <>
    <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} aria-haspopup="dialog" aria-controls="summary-output"
      disabled={!report.rows.length} onClick={() => open("csv")}>ส่งออก CSV</button>
    <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} aria-haspopup="dialog" aria-controls="summary-output"
      disabled={!report.rows.length} onClick={() => open("print")}>พิมพ์ / PDF</button>
    <dialog ref={dialog} id="summary-output" className={`${nativeDialogClass} ${styles.selectionDialog}`} aria-labelledby="summary-output-title">
      <div className={nativeDialogHeaderClass}>
        <h2 id="summary-output-title">{mode === "print" ? "เลือกโครงการสำหรับพิมพ์ / PDF" : "เลือกโครงการสำหรับส่งออก CSV"}</h2>
        <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} onClick={() => dialog.current?.close()}>ปิด</button>
      </div>
      <div className={`${nativeDialogBodyClass} ${styles.selectionBody}`}>
        <p className={styles.selectionCount} aria-live="polite">เลือก {count.toLocaleString("th-TH")} จาก {report.rows.length.toLocaleString("th-TH")} โครงการ</p>
        <dl className={styles.selectionTotals} aria-label="ยอดรวมโครงการที่เลือก (บาท)">
          {chosen.columns.map(column => <div key={column.key}>
            <dt>{column.label}</dt>
            <dd className={styles.money} data-state={amountState(column.key, column.total)}>{displayAmount(column.total)}</dd>
          </div>)}
        </dl>
        <fieldset className={styles.selectionGroup}>
          <legend>เลือกโครงการ</legend>
          <div className={styles.selectionFilters}>
            <Field>
              <FieldLabel htmlFor={`${id}-query`}>ค้นหาในรายการ</FieldLabel>
              <Input id={`${id}-query`} type="search" maxLength={150} placeholder="รหัสโครงการหรือชื่อลูกค้า" value={filters.query}
                onChange={event => setFilters({ ...filters, query: event.currentTarget.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-stage`}>ขั้นโครงการ</FieldLabel>
              <NativeSelect id={`${id}-stage`} value={filters.stage} onChange={event => setFilters({ ...filters, stage: event.currentTarget.value })}>
                <option value="">ทุกขั้น</option>
                {Object.entries(summaryStages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-money`}>กรองตามยอดเงิน</FieldLabel>
              <NativeSelect id={`${id}-money`} value={filters.money} onChange={event => setFilters({ ...filters, money: event.currentTarget.value })}>
                <option value="">ทุกโครงการ</option>
                {Object.entries(collectionFilters).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <div className={styles.selectionTools}>
            <p aria-live="polite">พบ {visible.length.toLocaleString("th-TH")} โครงการ
              {hiddenSelectedCount > 0 && ` · เลือกไว้นอกผลที่แสดง ${hiddenSelectedCount.toLocaleString("th-TH")} โครงการ`}</p>
            {count > 0 && <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} onClick={() => setSelected(new Set())}>ล้างที่เลือกทั้งหมด</button>}
          </div>
          <label className={styles.selectionOption}>
            <input type="checkbox" checked={isAllSelected} disabled={!visible.length}
              ref={input => { if (input) input.indeterminate = visibleSelectedCount > 0 && !isAllSelected; }}
              onChange={event => {
                const isSelected = event.currentTarget.checked;
                setSelected(current => updateSummarySelection(current, visible.map(row => row.id), isSelected));
              }} />
            <strong>เลือกทั้งหมดที่แสดง</strong>
          </label>
          <div className={styles.selectionList}>
            {visible.length === 0 && <p className={styles.selectionEmpty}>ไม่พบโครงการตามเงื่อนไขในกล่องนี้</p>}
            {visible.map(row => <label className={styles.selectionOption} key={row.id}>
              <input type="checkbox" checked={selected.has(row.id)}
                onChange={event => {
                  const isSelected = event.currentTarget.checked;
                  setSelected(current => updateSummarySelection(current, [row.id], isSelected));
                }} />
              <span><strong>{row.code}</strong>{row.customer && <small>{row.customer}</small>}</span>
            </label>)}
          </div>
        </fieldset>
      </div>
      <div className={styles.selectionActions}>
        <button type="button" className={buttonVariants({ size: "auto" })} disabled={!count} onClick={exportSelection}>
          {mode === "print" ? "พิมพ์โครงการที่เลือก" : "ดาวน์โหลด CSV"}
        </button>
      </div>
    </dialog>
    {printReport && createPortal(<main className={`${paper.printReport} ${paper.selectionPrint}`}>
      <h1>{title} · บ้านคุณภาพ</h1>
      <p>หน่วยบาท{printReport.periodLabel && ` · รับและคืนเงิน ${printReport.periodLabel}`}
        {printReport.rows.some(row => row.hasUnknownBalance || row.amounts.value === null) && " · รวมเฉพาะยอดที่ระบุได้"}</p>
      <ProjectTable report={printReport} rows={printReport.rows} />
    </main>, document.body)}
  </>;
}
