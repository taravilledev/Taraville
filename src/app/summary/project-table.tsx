import Link from "next/link";
import { amountState, displayAmount, type SummaryReport, type SummarySortKey, type summaryQuery } from "./summary-model";
import styles from "./summary.module.css";

type Report = SummaryReport;
type SortQuery = Pick<ReturnType<typeof summaryQuery>, "params" | "sort">;
export const identityColumns = [{ key: "code", label: "โครงการ" }, { key: "stage", label: "ขั้นปัจจุบัน" }] as const;

export function ProjectTable({ report, rows, query }: {
  report: Report; rows: Report["rows"]; query?: SortQuery;
}) {
  const isPrint = !query;
  if (!rows.length) return <p className={styles.empty}>ไม่พบโครงการตามตัวกรอง</p>;
  const totals = <tr role="row" className={styles.totalsRow}>
    <th scope="row" role="rowheader" colSpan={2}>รวม {report.rows.length.toLocaleString("th-TH")} โครงการ
      {!isPrint && <small>ตามตัวกรอง</small>}</th>
    {report.columns.map(column => <td role="cell" key={column.key} className={styles.money} data-state={amountState(column.key, column.total)}>
      <span className={styles.mobileLabel} aria-hidden="true">{column.label}</span><span>{displayAmount(column.total)}</span>
    </td>)}
  </tr>;
  return <div className={styles.tableWrap}>
    <table className={styles.table} role="table" aria-label="สรุปยอดโครงการ">
      <thead role="rowgroup"><tr role="row">
        {[...identityColumns, ...report.columns].map(column => <SummaryColumn key={column.key} column={column} query={query} />)}
      </tr></thead>
      <tbody role="rowgroup" aria-label="ยอดรวมโครงการ" className={styles.totalsGroup}>{totals}</tbody>
      <tbody role="rowgroup">
        {rows.map(row => <tr role="row" key={row.id}>
          <th scope="row" role="rowheader">
            {isPrint ? <strong>{row.code}</strong> : <Link className={styles.projectLink} href={`/sales/${row.id}?tab=money`} prefetch={false}
              aria-label={`เปิดการเงิน ${row.code}`}>{row.code}</Link>}
            {row.customer && <small>{row.customer}</small>}
            {row.owner && <small>ผู้ดูแล {row.owner}</small>}
            {row.hasUnknownBalance && <small>มียอดที่ยังระบุไม่ได้</small>}
          </th>
          <td role="cell" className={styles.stage}><span className={styles.stageBadge}>{row.stage}</span></td>
          {report.columns.map(column => <td role="cell" key={column.key} className={styles.money}
            data-state={amountState(column.key, row.amounts[column.key])}>
            <span className={styles.mobileLabel} aria-hidden="true">{column.label}</span><span>{displayAmount(row.amounts[column.key])}</span>
          </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function SummaryColumn({ column, query }: { column: { key: SummarySortKey; label: string }; query?: SortQuery }) {
  if (!query) return <th scope="col" role="columnheader">{column.label}</th>;
  const current = query.sort?.key === column.key ? query.sort.direction : undefined;
  const next = current === "desc" || (!current && (column.key === "code" || column.key === "stage")) ? "asc" : "desc";
  const params = new URLSearchParams(query.params);
  params.set("sort", `${column.key}.${next}`);
  return <th scope="col" role="columnheader" aria-sort={current === "asc" ? "ascending" : current === "desc" ? "descending" : undefined}>
    <Link className={styles.sortLink} href={`/summary?${params}#projects`} prefetch={false}
      aria-label={`เรียงตาม${column.label} ${next === "asc" ? "จากน้อยไปมาก" : "จากมากไปน้อย"}`}>
      {column.label} <span aria-hidden="true">{current === "asc" ? "↑" : current === "desc" ? "↓" : "↕"}</span>
    </Link>
  </th>;
}
