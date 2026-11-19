import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, ClipboardCheck, Clock, FileCheck, FileSignature, Receipt, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/sales/date";
import type { ExecutiveWork } from "@/lib/sales/executive";
import { brandLabels } from "@/lib/sales/models";
import { tagClass } from "@/components/tag";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const focusRing = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";
const metricClass = (compact: boolean) => cn(
  "relative grid min-w-0 gap-3 rounded-md border bg-card p-4 text-foreground no-underline hover:border-primary hover:bg-accent aria-[current]:border-primary aria-[current]:bg-accent max-[440px]:p-3",
  "[&_strong]:text-title [&_strong]:tabular-nums [&_small]:text-sm [&_small]:font-medium", focusRing,
  compact && "inline-flex min-h-(--tap-min) items-center gap-2 px-3 py-2 [&_strong]:text-sm [&_small]:hidden",
);
const tableClass = "w-full min-w-[43rem] border-collapse text-start text-sm [&_a]:underline-offset-4 [&_small]:block [&_small]:font-normal [&_small]:text-muted-foreground " +
  "[&_tbody_th_span]:block [&_tbody_th_span]:font-normal [&_tbody_th_span]:text-muted-foreground [&_tbody_tr:hover]:bg-accent " +
  "[&_td]:border-t [&_td]:px-4 [&_td]:py-3 [&_td]:text-start [&_th]:border-t [&_th]:px-4 [&_th]:py-3 [&_th]:text-start [&_thead]:bg-accent [&_thead]:text-muted-foreground";
const priorities = [
  { key: "pending", label: "เงินรอยืนยัน", Icon: Receipt, anchor: "pending" },
  { key: "overdue", label: "ใบแจ้งชำระเกินกำหนด", Icon: Clock, anchor: "collection-title" },
  { key: "acceptance", label: "งวดรอตรวจรับ", Icon: ClipboardCheck, anchor: "schedule" },
  { key: "refunds", label: "งานคืนเงิน", Icon: RotateCcw, anchor: "refunds" },
  { key: "quotation", label: "รอลูกค้ายืนยันใบเสนอราคา", Icon: FileCheck, anchor: "quotation" },
  { key: "signature", label: "สัญญารอลงนาม", Icon: FileSignature, anchor: "contract" },
] as const;
type Filters = { brand: string; status: string; query: string; attention: string; page: number };
const pageSize = 30;
const bangkokDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" });
const localDate = (timestamp: string) => formatDate(bangkokDate.format(new Date(timestamp)));

export function ExecutiveDashboard({ rows, filters, filterForm, compact = false }: { rows: ExecutiveWork[]; filters: Filters; filterForm: ReactNode; compact?: boolean }) {
  const active = priorities.find(item => item.key === filters.attention);
  const matches = active ? rows.filter(row => row[active.key] > 0) : rows;
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(filters.page, pages);
  const first = (page - 1) * pageSize;
  function href(attention = active?.key ?? "", nextPage = 1) {
    const params = new URLSearchParams();
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.status !== "active") params.set("status", filters.status);
    if (filters.query) params.set("q", filters.query);
    if (attention) params.set("attention", attention);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/dashboard${params.size ? `?${params}` : ""}`;
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
    <section aria-labelledby="projects-title" className="min-w-0 rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 p-4">
        <div><h2 id="projects-title" className="m-0 text-lg">ติดตามโครงการ</h2><p className="mt-1 mb-0 text-sm text-muted-foreground">
          {active ? `${active.label} · ` : ""}{matches.length.toLocaleString("th-TH")} โครงการ
        </p></div>
        {active && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href("")} prefetch={false}>ดูทุกโครงการ</Link>}
      </div>
      {matches.length ? <div className={cn("overflow-x-auto", focusRing)} role="region" aria-label="ตารางติดตามโครงการ" tabIndex={0}>
        <table className={tableClass}>
          <thead><tr><th scope="col">โครงการ / ลูกค้า</th><th scope="col">ผู้รับผิดชอบ</th><th scope="col">ขั้นปัจจุบัน</th>
            <th scope="col">รอตั้งแต่ / อัปเดต</th><th scope="col">งานถัดไป</th></tr></thead>
          <tbody>{matches.slice(first, first + pageSize).map(row => {
            const urgent = active;
            const action = !urgent ? row.action : {
              title: urgent.label,
              href: urgent.key === "quotation" || urgent.key === "signature" ? row.followUp[urgent.key] ?? `/sales/${row.id}?tab=overview`
                : `/sales/${row.id}?tab=money#${urgent.key === "overdue" && row.brand === "TARAVILLE" ? "schedule" : urgent.anchor}`,
            };
            return <tr key={row.id}>
              <th scope="row"><Link href={`/sales/${row.id}?tab=overview`} prefetch={false}>{row.code}</Link>
                <span>{row.customer} · {brandLabels[row.brand]}</span></th>
              <td>{row.owner}</td><td><span className={tagClass}>{row.stage}</span></td>
              <td>{row.waiting_since ? <><small>รอตั้งแต่</small>{localDate(row.waiting_since)}</>
                : <><small>อัปเดต</small>{localDate(row.updated_at)}</>}</td>
              <td>{action ? <Link href={action.href} prefetch={false} className={cn("inline-flex min-h-(--tap-min) items-center gap-1 font-semibold text-primary [&_svg]:flex-none", focusRing)}>{action.title}<ArrowUpRight size={15} aria-hidden="true" /></Link> : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <p className="m-0 p-4 text-muted-foreground">ไม่พบโครงการตามตัวกรอง</p>}
      {pages > 1 && <nav aria-label="หน้าตารางโครงการ" className="flex items-center justify-end gap-3 border-t p-4">
        {page > 1 && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href(active?.key, page - 1)} prefetch={false}>ก่อนหน้า</Link>}
        <span>หน้า {page} / {pages}</span>
        {page < pages && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={href(active?.key, page + 1)} prefetch={false}>ถัดไป</Link>}
      </nav>}
    </section>
  </>;
}
