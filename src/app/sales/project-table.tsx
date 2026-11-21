import Link from "next/link";
import { formatDate } from "@/lib/sales/date";
import { brandLabels, caseStatusLabels, caseStatusTones, type CaseStatus } from "@/lib/sales/models";
import { projectSteps } from "@/lib/sales/case-progress";
import type { StageTrackStatus } from "@/lib/sales/stage-track";
import { BrandTag } from "@/components/brand-tag";
import { DataRow, DataTable, RowLink } from "@/components/data-table";
import { StageTrack } from "@/components/stage-track";
import { Status } from "@/components/status";
import { tabLinksClass } from "@/components/tab-links";

type Brand = keyof typeof brandLabels;
export type ProjectRow = {
  id: string; href: string; code: string; customer: string; brand: Brand; owner: string; updated_at: string; status: CaseStatus;
  waiting_since?: string | null;
  // null when the viewer lacks financial.view: the table then shows the case status and no next task.
  track: { steps: string[]; current: number; status: StageTrackStatus } | null;
  action: { title: string; href: string; allowed: boolean } | null;
};

export const pageSize = 30;
const doneLabel = "ชำระครบ";
const closedLabel = "ปิดงาน / ยกเลิก";
const preLabel = "ก่อนทำสัญญา";
const bangkokDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" });
export const localDate = (timestamp: string) => formatDate(bangkokDate.format(new Date(timestamp)));

// The stage tab a row belongs to; both brands together merge the pre-contract steps (board SalesList).
function stageKey(row: ProjectRow, merged: boolean) {
  if (!row.track) return row.status === "completed" ? doneLabel : row.status === "cancelled" ? closedLabel : null;
  if (row.track.status === "done") return doneLabel;
  if (row.track.status === "cancelled") return closedLabel;
  return merged && (row.track.current === 1 || row.track.current === 2) ? preLabel : row.track.steps[row.track.current];
}
const isOpen = (row: ProjectRow) => row.status !== "completed" && row.status !== "cancelled" && row.track?.status !== "done";

function stageTabs(brand: string) {
  const steps = brand ? projectSteps(brand as Brand) : ["เปิดโครงการ", preLabel, "สัญญา", "รับชำระ"];
  return [...steps, doneLabel, closedLabel];
}

export function filterByStage(rows: ProjectRow[], brand: string, stage: string) {
  if (!stageTabs(brand).includes(stage)) return { stage: "", rows: rows.filter(isOpen) };
  return { stage, rows: rows.filter(row => stageKey(row, !brand) === stage) };
}

// Server-rendered tabs: `hrefFor(stage)` keeps the page's other filters in the link.
export function StageTabs({ rows, brand, stage, hrefFor }: { rows: ProjectRow[]; brand: string; stage: string; hrefFor: (stage: string) => string }) {
  const tabs = [{ key: "", label: "กำลังดำเนินการ", count: rows.filter(isOpen).length },
    ...stageTabs(brand).map(label => ({ key: label, label, count: rows.filter(row => stageKey(row, !brand) === label).length }))];
  return <nav className={tabLinksClass} aria-label="ขั้นของโครงการ">
    {tabs.map(({ key, label, count }) => <Link key={key} href={hrefFor(key)} prefetch={false} aria-current={key === stage ? "page" : undefined}>
      {label} <span className="ms-2 rounded-full bg-secondary px-1.5 text-xs tabular-nums">{count}</span></Link>)}
  </nav>;
}

export function ProjectTable({ rows }: { rows: ProjectRow[] }) {
  return <DataTable label="ตารางโครงการ">
    <thead><tr><th scope="col">โครงการ · ลูกค้า</th><th scope="col">แบรนด์</th><th scope="col">ขั้นปัจจุบัน</th>
      <th scope="col">งานถัดไป</th><th scope="col">ผู้ดูแล</th><th scope="col">อัปเดต</th></tr></thead>
    <tbody>{rows.map(row => <DataRow key={row.id}>
      <td><RowLink href={row.href} className="font-bold text-foreground">{row.code} · {row.customer}</RowLink></td>
      <td><BrandTag brand={row.brand} /></td>
      <td>{row.track ? <StageTrack {...row.track} /> : <Status tone={caseStatusTones[row.status]}>{caseStatusLabels[row.status]}</Status>}</td>
      <td>{row.action?.allowed
        ? <Link className="relative z-1 font-semibold text-primary underline-offset-4 hover:underline" href={row.action.href} prefetch={false}>{row.action.title} ›</Link>
        : row.action ? <span className="text-muted-foreground">{row.action.title}</span> : <span className="text-muted-foreground">—</span>}</td>
      <td>{row.owner}</td>
      <td className="whitespace-nowrap text-muted-foreground">{row.waiting_since
        ? <><small className="block text-xs">รอตั้งแต่</small>{localDate(row.waiting_since)}</>
        : <><small className="block text-xs">อัปเดต</small>{localDate(row.updated_at)}</>}</td>
    </DataRow>)}</tbody>
  </DataTable>;
}
