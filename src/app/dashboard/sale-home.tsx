import Link from "next/link";
import type { z } from "zod";
import type { salesCaseList } from "@/lib/sales/queries";
import type { workQueueSchema } from "@/lib/sales/models";
import { BrandTag } from "@/components/brand-tag";
import { noticeClass } from "@/components/notice";
import { panelClass } from "@/components/panel";
import { StageTrack } from "@/components/stage-track";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QueueTable } from "./queue-table";
import { QUEUE_FILTERS, type QueueFilter } from "./queue-filters";

type Queue = z.infer<typeof workQueueSchema> | null;
type Project = Awaited<ReturnType<typeof salesCaseList>>[number];
type Props = { queue: Queue; openLeads: number | null; mine: Project[]; filter: QueueFilter | null };

const cardClass = "flex min-h-28 min-w-0 flex-col items-start gap-1 rounded-lg border bg-card p-4 text-start no-underline hover:bg-accent " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[current=true]:border-2 aria-[current=true]:border-primary aria-[current=true]:bg-primary-tint";
const count = (value: number | null) => value === null ? "—" : value.toLocaleString("th-TH");

export function SaleHome({ queue, openLeads, mine, filter }: Props) {
  const sum = (...kinds: string[]) => queue ? queue.filter(item => kinds.includes(item.kind)).reduce((total, item) => total + item.count, 0) : null;
  const overdue = queue ? queue.filter(item => item.kind === "design_fee").reduce((total, item) => total + item.overdue, 0) : 0;
  const cards = QUEUE_FILTERS.map(({ key, label, kinds }) => {
    const value = sum(...kinds);
    const approved = sum("refund_approved");
    const sub = !queue ? "" : !value ? "ไม่มีรายการ"
      : key === "payment" ? "รอตรวจหลักฐานและยืนยัน" : key === "acceptance" ? "ตรวจแล้วจึงออกบิลงวดได้"
      : key === "refund" ? (approved ? "อนุมัติแล้ว รอจ่ายจริง" : "รอผู้บริหารอนุมัติ") : overdue ? `เกินกำหนด ${overdue.toLocaleString("th-TH")} ใบ` : "ยังไม่เกินกำหนด";
    return { key, label, value, sub, warn: key === "design" && overdue > 0 };
  });
  return <>
    <section aria-label="สรุปงาน" className="grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-1">
      {cards.map(({ key, label, value, sub, warn }) => <Link key={key} className={cardClass} prefetch={false}
        href={filter === key ? "/dashboard#queue" : `/dashboard?kind=${key}#queue`} aria-current={filter === key ? "true" : undefined}>
        <span className="text-sm font-semibold">{label}</span>
        <strong className={cn("text-2xl tabular-nums", !value && "text-muted-foreground")}>{count(value)}</strong>
        <span className={cn("text-xs text-muted-foreground", warn && "font-semibold text-danger-ink")}>{sub}</span>
      </Link>)}
      <Link className={cardClass} href="/leads?stage=open" prefetch={false}>
        <span className="text-sm font-semibold">Lead ที่ยังไม่เปิดโครงการ</span>
        <strong className="text-2xl tabular-nums">{count(openLeads)}</strong>
        <span className="text-xs font-semibold text-primary">ไปที่รายการ Lead ›</span>
      </Link>
    </section>
    <section className={panelClass} id="queue" aria-labelledby="queue-title"><h2 id="queue-title">งานรอทำ</h2>
      {!queue ? <p className={noticeClass} role="status">โหลดงานรอทำไม่ได้ ลองรีเฟรชหน้านี้ รายการทั้งหมดที่เมนูโครงการยังใช้ได้</p>
        : <QueueTable queue={queue} filter={filter} />}
    </section>
    <section className="grid gap-3" aria-labelledby="mine-title">
      <div className="flex items-center justify-between gap-3"><h2 id="mine-title" className="m-0">โครงการที่ฉันดูแล</h2>
        <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/sales?ownership=mine" prefetch={false}>ดูทั้งหมดในหน้าโครงการ ›</Link></div>
      {mine.length ? <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3 p-0">{mine.map(({ id, code, customer_name, brand, work }) =>
        <li key={id} className="flex min-w-0 flex-col items-start gap-2 rounded-lg border bg-card p-3.5">
          <Link className="font-bold tabular-nums" href={`/sales/${id}`} prefetch={false}>{code}</Link>
          <span className="max-w-full truncate text-sm text-muted-foreground">{customer_name}</span>
          <BrandTag brand={brand} />
          {work && <StageTrack {...work.track} />}
          {work?.action?.allowed && <Link className="mt-auto text-sm font-semibold" href={work.action.href} prefetch={false}>{work.action.title} ›</Link>}
        </li>)}</ul> : <p className="text-sm text-muted-foreground">ไม่พบโครงการที่คุณดูแลในรายการนี้</p>}
    </section>
  </>;
}
