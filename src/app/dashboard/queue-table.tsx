import Link from "next/link";
import type { z } from "zod";
import { workQueueKinds, type workQueueSchema } from "@/lib/sales/models";
import { BrandTag } from "@/components/brand-tag";
import { DataRow, DataTable, RowLink } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { QUEUE_FILTERS, type QueueFilter } from "./queue-filters";

type Item = z.infer<typeof workQueueSchema>[number];

const DAY_MS = 86_400_000;
const thaiDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
const anchors: Record<Item["kind"], string> = { acceptance: "schedule", payment_pending: "pending", design_fee: "design-fees", refund_pending: "refunds", refund_approved: "refunds" };

// design_fee `since` is the earliest due date (may be in the future); the other kinds start when the work arrived.
function wait(item: Item) {
  const days = Math.floor((Date.now() - Date.parse(item.since)) / DAY_MS);
  if (item.kind === "design_fee") return { late: days > 0, note: `ครบกำหนด ${thaiDate(item.since)}`,
    text: days > 0 ? `เกินกำหนด ${days.toLocaleString("th-TH")} วัน` : days < 0 ? `ครบกำหนดอีก ${(-days).toLocaleString("th-TH")} วัน` : "ครบกำหนดวันนี้" };
  return { late: false, note: `ตั้งแต่ ${thaiDate(item.since)}`, text: days > 0 ? `รอ ${days.toLocaleString("th-TH")} วัน` : "รอตั้งแต่วันนี้" };
}

// Task-first list, longest wait first; each row opens the case at the section that does the work.
export function QueueTable({ queue, filter }: { queue: Item[]; filter: QueueFilter | null }) {
  const active = QUEUE_FILTERS.find(({ key }) => key === filter);
  const rows = queue.filter(item => !active || (active.kinds as readonly string[]).includes(item.kind)).toSorted((a, b) => Date.parse(a.since) - Date.parse(b.since));
  return <>
    {active && <p className="mb-3"><Link className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line-strong bg-primary-tint px-3 text-sm text-primary" href="/dashboard#queue" prefetch={false} aria-label={`ล้างตัวกรอง ${active.label}`}>เฉพาะ{active.label} <span aria-hidden="true">×</span></Link></p>}
    {!rows.length ? <p className="text-sm text-muted-foreground">ไม่มีงานที่รอคุณดำเนินการ</p>
      : <DataTable label="งานรอทำ">
        <thead><tr><th scope="col">งาน</th><th scope="col">โครงการ</th><th scope="col">ยอด</th><th scope="col">รอนาน</th><th scope="col"><span className="sr-only">ทำต่อ</span></th></tr></thead>
        <tbody>{rows.map(item => {
          const { text, late, note } = wait(item);
          return <DataRow key={`${item.case_id}:${item.kind}`}>
            <td className="font-semibold">{workQueueKinds[item.kind]}</td>
            <td><span className="font-semibold tabular-nums">{item.code}</span>{item.customer_name && <span className="block text-xs text-muted-foreground">{item.customer_name}</span>}<BrandTag brand={item.brand} /></td>
            <td className="whitespace-nowrap tabular-nums">{item.count.toLocaleString("th-TH")} รายการ</td>
            <td className="whitespace-nowrap"><span className={cn(late ? "font-bold text-danger-ink" : "text-warn-ink")}>{text}</span><span className="block text-xs text-muted-foreground">{note}</span></td>
            <td className="text-end"><RowLink className="font-semibold text-primary" href={`/sales/${item.case_id}?tab=money#${anchors[item.kind]}`}>ทำต่อ ›</RowLink></td>
          </DataRow>;
        })}</tbody>
      </DataTable>}
  </>;
}
