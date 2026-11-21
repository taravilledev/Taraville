import { noticeClass } from "@/components/notice";
import { formatDate } from "@/lib/sales/date";
import { AmountGuideDialog } from "./amount-guide-dialog";
import { collectionFilters, summaryStages, type summaryQuery, type SummaryReport } from "./summary-model";
import * as styles from "./summary-styles";

type Query = ReturnType<typeof summaryQuery>;

export function ReportError({ query }: { query: Query }) {
  return <p className={noticeClass} role="alert">{query.isPeriodValid ? "โหลดสรุปโครงการไม่ได้ กรุณาลองใหม่"
    : "กรุณาเลือกช่วงวันที่ที่ถูกต้อง วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"}</p>;
}

export function ReportScope({ report, query, isPrint = false }: { report: SummaryReport | null; query: Query; isPrint?: boolean }) {
  if (!report) return null;
  const labels = isPrint ? [
    query.filters.query && `ค้นหา “${query.filters.query}”`,
    query.filters.owner && `ผู้ดูแล ${query.filters.owner}`,
    query.filters.stage && summaryStages[query.filters.stage as keyof typeof summaryStages],
    query.filters.money && collectionFilters[query.filters.money as keyof typeof collectionFilters],
  ].filter(Boolean) : [];
  const period = query.from && query.to && query.from === query.to ? formatDate(query.from)
    : query.from && query.to ? `${formatDate(query.from)} – ${formatDate(query.to)}`
    : query.from ? `ตั้งแต่ ${formatDate(query.from)}` : query.to ? `ถึง ${formatDate(query.to)}` : "";
  const hasUnknownBalance = report.rows.some(row => row.hasUnknownBalance);
  const hasUnknownValue = report.rows.some(row => row.amounts.value === null);
  const hasUnknown = hasUnknownBalance || hasUnknownValue;
  const notes = <>
    <dl className={styles.glossary}>
      {report.columns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{column.description}</dd></div>)}
    </dl>
    {period && <p>เลือกวันที่เพื่อดูเงินเข้าและเงินคืนเฉพาะช่วงนั้น ยอดสะสมและยอดค้างยังแสดงตามข้อมูลล่าสุด</p>}
    {hasUnknown && <p>ถ้าราคาหรือยอดค้างบางรายการยังไม่มีข้อมูล ระบบจะรวมเฉพาะตัวเลขที่มี</p>}
    <p className={styles.noteExample}><strong>ตัวอย่าง</strong> ลูกค้าค้างตามบิล 30,000 บาท ในจำนวนนี้เลยกำหนด 10,000 บาท ยอดค้างตามบิลจึงยังเป็น 30,000 บาท</p>
  </>;
  return <div className={styles.scope}>
    <p>หน่วยบาท · {period ? `รับและคืนเงิน ${period} · ยอดค้างเป็นยอดล่าสุด` : "ยอดล่าสุด ณ วันนี้"}
      {labels.length > 0 && ` · ${labels.join(" · ")}`}{!isPrint && hasUnknown && " · รวมเฉพาะยอดที่ระบุได้"}</p>
    {!isPrint && <AmountGuideDialog><div className={styles.notes}>{notes}</div></AmountGuideDialog>}
  </div>;
}
