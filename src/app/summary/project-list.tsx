import Link from "next/link";
import type { ReactNode } from "react";
import { StageTrack } from "@/components/stage-track";
import { tabLinksClass } from "@/components/tab-links";
import { bkpOverviewStages } from "@/lib/sales/bkp-workflow";
import { cn } from "@/lib/utils";
import { amountState, displayAmount, summaryHref, summaryStages, type SummaryReport, type SummarySortKey, type summaryQuery } from "./summary-model";
import * as styles from "./summary-styles";

type Query = Pick<ReturnType<typeof summaryQuery>, "params" | "sort">;
type Row = SummaryReport["rows"][number];
const stageSteps = Object.values(bkpOverviewStages);
const stageIndex = (key: string) => Object.keys(bkpOverviewStages).indexOf(key);
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
// A number never breaks across lines; only the label before it may wrap, so the table never needs a horizontal scroll.
const nb = (text: string) => <span className="whitespace-nowrap">{text}</span>;
const sub = "block text-xs font-semibold";

function Amount({ columnKey, amount }: { columnKey: Parameters<typeof amountState>[0]; amount: bigint | null }) {
  const isZero = amount === BigInt(0);
  return <span className={styles.money} data-state={amountState(columnKey, amount)}>{isZero ? "–" : nb(displayAmount(amount))}</span>;
}

function moneyParts(row: Row, hasPeriod: boolean): { value: ReactNode; billed: ReactNode; unbilled: ReactNode; pending: ReactNode } {
  const { amounts } = row;
  return {
    value: <>
      <span className="tabular-nums">{nb(displayAmount(amounts.value))}</span>
      <span className={cn(sub, "text-success-ink")}>รับแล้ว {nb(displayAmount(amounts.received))}</span>
      {hasPeriod && <span className={cn(sub, "text-primary")}>ในช่วง {nb(`${amounts.period > BigInt(0) ? "+" : ""}${displayAmount(amounts.period)}`)}</span>}
    </>,
    billed: <>
      <Amount columnKey="billed" amount={amounts.billed} />
      {amounts.overdue > BigInt(0) && <span className={cn(sub, "text-danger-ink")}>เกินกำหนด {nb(displayAmount(amounts.overdue))}</span>}
    </>,
    unbilled: <Amount columnKey="unbilled" amount={amounts.unbilled} />,
    pending: <Amount columnKey="pending" amount={amounts.pending} />,
  };
}

function StageCell({ row }: { row: Row }) {
  const index = stageIndex(row.stageKey);
  return <span className="flex flex-col items-start gap-1">
    {row.stageKey === "cancelled" ? <StageTrack steps={stageSteps} current={0} status="cancelled" />
      : index >= 0 ? <StageTrack steps={stageSteps} current={index} status="active" />
      : <span className={styles.stageBadge}>{row.stage}</span>}
    {row.amounts.closeout > BigInt(0) && <span className="text-xs font-semibold text-warn-ink">ค้างตามข้อตกลงปิดงาน {nb(displayAmount(row.amounts.closeout))}</span>}
  </span>;
}

function Identity({ row }: { row: Row }) {
  return <>
    <Link className={styles.projectLink} href={`/sales/${row.id}?tab=money`} prefetch={false} aria-label={`เปิดการเงิน ${row.code}`}>{row.code}</Link>
    {(row.customer || row.owner) && <small>{[row.customer, row.owner].filter(Boolean).join(" · ")}</small>}
    {row.hasUnknownBalance && <small className="text-warn-ink">มียอดที่ยังระบุไม่ได้</small>}
  </>;
}

function SortHeader({ column, query, className }: { column: { key: SummarySortKey; label: string }; query: Query; className?: string }) {
  const current = query.sort?.key === column.key ? query.sort.direction : undefined;
  const next = current === "desc" || (!current && (column.key === "code" || column.key === "stage")) ? "asc" : "desc";
  return <th scope="col" className={className} aria-sort={current === "asc" ? "ascending" : current === "desc" ? "descending" : undefined}>
    <Link className={styles.sortLink} href={summaryHref(query.params, { sort: `${column.key}.${next}` }, "#projects")} prefetch={false}
      aria-label={`เรียงตาม${column.label} ${next === "asc" ? "จากน้อยไปมาก" : "จากมากไปน้อย"}`}>
      {column.label} <span aria-hidden="true">{current === "asc" ? "↑" : current === "desc" ? "↓" : "↕"}</span>
    </Link>
  </th>;
}

function StageTabs({ counts, total, stage, params }: { counts: Record<string, number>; total: number; stage: string; params: URLSearchParams }) {
  const tabs = [{ key: "", label: "ทุกขั้น", count: total }, ...Object.entries(summaryStages).map(([key, label]) => ({ key, label, count: counts[key] ?? 0 }))]
    .filter(tab => tab.count > 0 || tab.key === "" || tab.key === stage || tab.key in bkpOverviewStages || tab.key === "cancelled");
  return <nav aria-label="ขั้นโครงการ" className={cn(tabLinksClass, "gap-0.5 px-3")}>
    {tabs.map(({ key, label, count }) => <Link key={key} prefetch={false} href={summaryHref(params, { stage: key || null }, "#projects")} aria-current={stage === key ? "page" : undefined}>
      {label}<span className="ms-2 min-w-5 rounded-full bg-secondary px-1.5 text-center text-xs font-normal text-muted-foreground">{count.toLocaleString("th-TH")}</span>
    </Link>)}
  </nav>;
}

export function ProjectList({ report, rows, query, stage, stageCounts, total }: {
  report: SummaryReport; rows: Row[]; query: Query; stage: string; stageCounts: Record<string, number>; total: number;
}) {
  const hasPeriod = report.columns.some(column => column.key === "period");
  const th = "bg-accent p-3 text-xs text-muted-foreground";
  return <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
    <StageTabs counts={stageCounts} total={total} stage={stage} params={query.params} />
    {rows.length === 0 ? <div className="grid justify-items-center gap-2 p-8 text-muted-foreground">
      <strong className="text-foreground">ไม่พบโครงการตามตัวกรอง</strong>
      <Link className={cn("font-semibold text-primary underline", focusRing)} prefetch={false}
        href={summaryHref(query.params, { q: null, owner: null, money: null, stage: null }, "#projects")}>ล้างตัวกรอง</Link>
    </div> : <>
      <table className="hidden w-full table-fixed border-separate border-spacing-0 text-sm min-[1024px]:table
        [&_td]:border-b [&_td]:p-3 [&_td]:align-top [&_td]:[overflow-wrap:anywhere] [&_tbody_th]:border-b [&_tbody_th]:p-3 [&_tbody_th]:text-start [&_tbody_th]:align-top
        [&_tr:last-child_:is(td,th)]:border-b-0 [&_small]:block [&_small]:text-muted-foreground [&_th_small]:font-normal" aria-label="สรุปยอดโครงการ">
        <colgroup><col className="w-1/4" /><col className="w-[17%]" /><col className="w-[18%]" /><col className="w-[15%]" /><col className="w-[14%]" /><col className="w-[11%]" /></colgroup>
        <thead><tr className="[&>th]:text-start [&>th:nth-child(n+3)]:text-end">
          <SortHeader column={{ key: "code", label: "โครงการ" }} query={query} className={th} />
          <SortHeader column={{ key: "stage", label: "ขั้นปัจจุบัน" }} query={query} className={th} />
          <SortHeader column={{ key: "value", label: "มูลค่า · รับแล้ว" }} query={query} className={th} />
          <SortHeader column={{ key: "billed", label: "ค้างตามบิล" }} query={query} className={th} />
          <SortHeader column={{ key: "unbilled", label: "ยังไม่ออกบิล" }} query={query} className={th} />
          <SortHeader column={{ key: "pending", label: "เงินรอยืนยัน" }} query={query} className={th} />
        </tr></thead>
        <tbody>{rows.map(row => {
          const parts = moneyParts(row, hasPeriod);
          return <tr key={row.id}>
            <th scope="row"><Identity row={row} /></th>
            <td><StageCell row={row} /></td>
            <td className="text-end">{parts.value}</td>
            <td className="text-end">{parts.billed}</td>
            <td className="text-end">{parts.unbilled}</td>
            <td className="text-end">{parts.pending}</td>
          </tr>;
        })}</tbody>
      </table>
      <ul className="m-0 grid list-none gap-3 p-3 min-[1024px]:hidden [&_small]:block [&_small]:text-muted-foreground">
        {rows.map(row => {
          const parts = moneyParts(row, hasPeriod);
          const cells: [string, ReactNode][] = [["มูลค่า · รับแล้ว", parts.value], ["ค้างตามบิล", parts.billed], ["ยังไม่ออกบิล", parts.unbilled], ["เงินรอยืนยัน", parts.pending]];
          return <li key={row.id} className="grid gap-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 [overflow-wrap:anywhere]"><Identity row={row} /></div>
              <StageCell row={row} />
            </div>
            <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2">
              {cells.map(([label, content]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="m-0">{content}</dd></div>)}
            </dl>
          </li>;
        })}
      </ul>
    </>}
  </div>;
}
