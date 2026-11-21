import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, ClipboardCheck, Clock, FileCheck, FileSignature, Receipt, RotateCcw } from "lucide-react";
import type { ExecutiveWork } from "@/lib/sales/executive";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filterByStage, pageSize, ProjectTable, StageTabs, type ProjectRow } from "./project-table";

const focusRing = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";
const metricClass = (compact: boolean) => cn(
  "relative grid min-w-0 gap-3 rounded-md border bg-card p-4 text-foreground no-underline hover:border-primary hover:bg-accent aria-[current]:border-primary aria-[current]:bg-accent max-[440px]:p-3",
  "[&_strong]:text-title [&_strong]:tabular-nums [&_small]:text-sm [&_small]:font-medium", focusRing,
  compact && "inline-flex min-h-(--tap-min) items-center gap-2 px-3 py-2 [&_strong]:text-sm [&_small]:hidden",
);
const priorities = [
  { key: "pending", label: "เงินรอยืนยัน", Icon: Receipt, anchor: "pending" },
  { key: "overdue", label: "ใบแจ้งชำระเกินกำหนด", Icon: Clock, anchor: "collection-title" },
  { key: "acceptance", label: "งวดรอตรวจรับ", Icon: ClipboardCheck, anchor: "schedule" },
  { key: "refunds", label: "งานคืนเงิน", Icon: RotateCcw, anchor: "refunds" },
  { key: "quotation", label: "รอลูกค้ายืนยันใบเสนอราคา", Icon: FileCheck, anchor: "quotation" },
  { key: "signature", label: "สัญญารอลงนาม", Icon: FileSignature, anchor: "contract" },
] as const;
type Filters = { brand: string; status: string; query: string; attention: string; stage: string; page: number };
type Priority = (typeof priorities)[number];

// An attention chip replaces each row's next task with that chip's task, as before.
const toProjectRow = (urgent: Priority | undefined) => (row: ExecutiveWork): ProjectRow => ({
  id: row.id, href: `/sales/${row.id}?tab=overview`, code: row.code, customer: row.customer, brand: row.brand, owner: row.owner,
  updated_at: row.updated_at, status: row.status, waiting_since: row.waiting_since, track: row.track,
  action: !urgent ? row.action : { allowed: true, title: urgent.label,
    href: urgent.key === "quotation" || urgent.key === "signature" ? row.followUp[urgent.key] ?? `/sales/${row.id}?tab=overview`
      : `/sales/${row.id}?tab=money#${urgent.key === "overdue" && row.brand === "TARAVILLE" ? "schedule" : urgent.anchor}` },
});

export function ExecutiveDashboard({ rows, filters, filterForm, basePath, compact = false }: { rows: ExecutiveWork[]; filters: Filters; filterForm: ReactNode; basePath: string; compact?: boolean }) {
  const active = priorities.find(item => item.key === filters.attention);
  const attentionRows = (active ? rows.filter(row => row[active.key] > 0) : rows).map(toProjectRow(active));
  const { stage, rows: matches } = filterByStage(attentionRows, filters.brand, filters.stage);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(filters.page, pages);
  const pageRows = matches.slice((page - 1) * pageSize, page * pageSize);
  function href(attention = active?.key ?? "", nextPage = 1, nextStage = stage) {
    const params = new URLSearchParams();
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.status !== "active") params.set("status", filters.status);
    if (filters.query) params.set("q", filters.query);
    if (attention) params.set("attention", attention);
    if (nextStage) params.set("stage", nextStage);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `${basePath}${params.size ? `?${params}` : ""}`;
  }
  return <>
    <section aria-labelledby="queue-title" id="queue" className="min-w-0">
      <h2 id="queue-title" className="m-0 text-lg">{compact ? "กรองตารางโครงการตามงาน" : "งานที่ต้องติดตาม"}</h2>
      <div className={cn("mt-3 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2", compact && "flex flex-wrap gap-2")}>
        {(compact ? priorities : priorities.slice(0, 4)).map(({ key, label, Icon }) => <Link key={key} href={href(active?.key === key ? "" : key)} prefetch={false}
          className={metricClass(compact)} aria-current={active?.key === key ? "true" : undefined}>
          <span className={cn("flex items-center gap-2 pr-4 text-muted-foreground max-[440px]:pr-0 [&_svg]:flex-none [&_svg]:text-primary", compact && "p-0")}><Icon size={18} aria-hidden="true" />{label}</span>
          <strong>{rows.reduce((total, row) => total + row[key], 0).toLocaleString("th-TH")} <small>{key === "quotation" || key === "signature" ? "โครงการ" : "รายการ"}</small></strong>
          <ArrowUpRight className={cn("absolute top-4 right-3 text-primary max-[440px]:hidden", compact && "hidden")} size={16} aria-hidden="true" />
        </Link>)}
      </div>
    </section>
    {filterForm}
    <StageTabs rows={attentionRows} brand={filters.brand} stage={stage} hrefFor={next => href(undefined, 1, next)} />
    <section aria-labelledby="projects-title" className="min-w-0">
      <div className="flex items-center justify-between gap-3 p-4">
        <div><h2 id="projects-title" className="m-0 text-lg">ติดตามโครงการ</h2><p className="mt-1 mb-0 text-sm text-muted-foreground">
          {active ? `${active.label} · ` : ""}{matches.length.toLocaleString("th-TH")} โครงการ
        </p></div>
        {active && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href("")} prefetch={false}>ดูทุกโครงการ</Link>}
      </div>
      {pageRows.length ? <ProjectTable rows={pageRows} /> : <p className="m-0 p-4 text-muted-foreground">ไม่พบโครงการตามตัวกรอง</p>}
      {pages > 1 && <nav aria-label="หน้าตารางโครงการ" className="flex items-center justify-end gap-3 border-t p-4">
        {page > 1 && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href(active?.key, page - 1)} prefetch={false}>ก่อนหน้า</Link>}
        <span>หน้า {page} / {pages}</span>
        {page < pages && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href(active?.key, page + 1)} prefetch={false}>ถัดไป</Link>}
      </nav>}
    </section>
  </>;
}
