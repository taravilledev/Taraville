import { CircleX, Folder, UserPlus } from "lucide-react";
import { BrandMark } from "@/components/brand-tag";
import { STAGE_GROUPS, STAGE_GROUP_LABELS, type StageGroup } from "@/lib/walkin/lead-stage";
import { foldStageGroups, rankOwners, REPORT_BRAND_LABELS, type MonthlyReport } from "@/lib/walkin/monthly-report";
import { CountRow, ReportBox, TeamTag } from "./report-box";
import { OwnerBox } from "./owner-box";

type Summary = MonthlyReport["summary"];
type Brand = keyof typeof REPORT_BRAND_LABELS;

const stageDot: Record<StageGroup, string> = { open: "bg-warn-ink", project: "bg-success", closed: "bg-muted-foreground" };

export function ReportCards({ summary, isSale }: { summary: Summary; isSale: boolean }) {
  const cards = [
    { label: "Lead ใหม่", value: summary.total, hint: "ลงทะเบียนในเดือนนี้", Icon: UserPlus, tile: "bg-primary-tint text-primary" },
    { label: "เปิดโครงการแล้ว", value: summary.project_opened, hint: "จาก Lead ที่ลงทะเบียนเดือนนี้", Icon: Folder, tile: "bg-success-tint text-success-ink" },
    { label: "ปิดแล้ว", value: summary.closed, hint: "จาก Lead ที่ลงทะเบียนเดือนนี้", Icon: CircleX, tile: "bg-secondary text-muted-foreground" },
  ];
  return <section aria-label="สรุป" className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
    {cards.map(({ label, value, hint, Icon, tile }) => <div key={label} className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3.5">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`grid size-7 shrink-0 place-items-center rounded-sm ${tile}`} aria-hidden="true"><Icon size={16} /></span>
        {label}{isSale && <TeamTag />}
      </span>
      <strong className="text-title tabular-nums">{value.toLocaleString("th-TH")}</strong>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>)}
  </section>;
}

// Executive: stage + brand stacked on the left, owners on the right at full height. Sale: no owner box (it would only repeat the table count).
export function ReportBreakdowns({ summary, isSale, brand }: { summary: Summary; isSale: boolean; brand?: Brand }) {
  const stages = foldStageGroups(summary.by_stage);
  const brands = brand ? [brand] : (Object.keys(REPORT_BRAND_LABELS) as Brand[]);
  const place = (cell: string) => isSale ? "" : cell;
  return <section aria-label="แยกตาม" className={`grid grid-cols-2 gap-3 max-[640px]:grid-cols-1 ${isSale ? "" : "grid-rows-[auto_1fr]"}`}>
    <ReportBox title="แยกตามขั้น" isTeam={isSale} className={place("min-[641px]:col-start-1 min-[641px]:row-start-1")}>
      <ul className="m-0 flex list-none flex-col p-0">
        {STAGE_GROUPS.map(group => <CountRow key={group} label={STAGE_GROUP_LABELS[group]} count={stages[group]}
          mark={<span className={`size-2 rounded-full ${stageDot[group]}`} aria-hidden="true" />} />)}
      </ul>
    </ReportBox>
    <ReportBox title="แยกตามแบรนด์" isTeam={isSale} className={place("min-[641px]:col-start-1 min-[641px]:row-start-2")}>
      <ul className="m-0 flex list-none flex-col p-0">
        {brands.map(key => <CountRow key={key} label={REPORT_BRAND_LABELS[key]} count={summary.by_brand[key] ?? 0} mark={<BrandMark brand={key} />} />)}
      </ul>
    </ReportBox>
    {!isSale && <OwnerBox owners={rankOwners(summary.by_owner)} />}
  </section>;
}
