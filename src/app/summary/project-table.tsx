import { amountState, displayAmount, type SummaryReport } from "./summary-model";
import * as styles from "./summary-styles";

type Report = SummaryReport;
const identityColumns = [{ key: "code", label: "โครงการ" }, { key: "stage", label: "ขั้นปัจจุบัน" }] as const;

// Paper table (the ?print view and the selection dialog's print portal): every money column, no links.
export function ProjectTable({ report, rows }: { report: Report; rows: Report["rows"] }) {
  if (!rows.length) return <p className={styles.empty}>ไม่พบโครงการตามตัวกรอง</p>;
  return <div className={styles.tableWrap}>
    <table className={styles.table} role="table" aria-label="สรุปยอดโครงการ">
      <thead role="rowgroup"><tr role="row">
        {[...identityColumns, ...report.columns].map(column => <th scope="col" role="columnheader" key={column.key}>{column.label}</th>)}
      </tr></thead>
      <tbody role="rowgroup" aria-label="ยอดรวมโครงการ">
        <tr role="row" className={styles.totalsRow}>
          <th scope="row" role="rowheader" colSpan={2}>รวม {report.rows.length.toLocaleString("th-TH")} โครงการ</th>
          {report.columns.map(column => <td role="cell" key={column.key} className={styles.moneyCell} data-state={amountState(column.key, column.total)}>
            <span>{displayAmount(column.total)}</span>
          </td>)}
        </tr>
      </tbody>
      <tbody role="rowgroup">
        {rows.map(row => <tr role="row" key={row.id}>
          <th scope="row" role="rowheader">
            <strong>{row.code}</strong>
            {row.customer && <small>{row.customer}</small>}
            {row.owner && <small>ผู้ดูแล {row.owner}</small>}
            {row.hasUnknownBalance && <small>มียอดที่ยังระบุไม่ได้</small>}
          </th>
          <td role="cell"><span className={styles.stageBadge}>{row.stage}</span></td>
          {report.columns.map(column => <td role="cell" key={column.key} className={styles.moneyCell}
            data-state={amountState(column.key, row.amounts[column.key])}><span>{displayAmount(row.amounts[column.key])}</span></td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}
