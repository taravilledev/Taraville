import Link from "next/link";
import { CalendarRange, ClipboardList, Clock, FileText, Receipt, Wallet, type LucideIcon } from "lucide-react";
import { displayAmount, summaryHref, type SummaryReport } from "./summary-model";
import { cn } from "@/lib/utils";

type Key = "value" | "received" | "period" | "billed" | "unbilled" | "pending";
// Static cards only report a total; the others filter the list by the same money key. Tile colour follows meaning only.
const cards: { key: Key; label: string; hint: string; icon: LucideIcon; tile: string; isFilter: boolean }[] = [
  { key: "value", label: "มูลค่าโครงการ", hint: "ราคาโครงการที่ระบุในระบบ · ยังไม่มีมูลค่าไม่นับ", icon: FileText, tile: "bg-primary-tint text-primary", isFilter: false },
  { key: "received", label: "รับสุทธิสะสม", hint: "รับจริงทั้งหมด หักเงินคืนแล้ว", icon: Wallet, tile: "bg-success-tint text-success-ink", isFilter: false },
  { key: "period", label: "รับสุทธิในช่วง", hint: "รับและคืนเงินในช่วงที่เลือก", icon: CalendarRange, tile: "bg-success-tint text-success-ink", isFilter: false },
  { key: "billed", label: "ค้างตามบิล", hint: "ออกบิลแล้ว รวมที่ยังไม่ถึงกำหนด", icon: Receipt, tile: "bg-warn-tint text-warn-ink", isFilter: true },
  { key: "unbilled", label: "ยังไม่ออกบิล", hint: "งวดที่ยังไม่ออกบิล รวมค่าออกแบบ", icon: ClipboardList, tile: "bg-secondary text-muted-foreground", isFilter: true },
  { key: "pending", label: "เงินรอยืนยัน", hint: "บันทึกเงินเข้าแล้ว ยังไม่ยืนยันรับจริง", icon: Clock, tile: "bg-warn-tint text-warn-ink", isFilter: true },
];
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const pillClass = `inline-flex min-h-8 items-center rounded-full border px-3 text-sm no-underline ${focusRing}`;

export function SummaryCards({ report, params, money }: { report: SummaryReport; params: URLSearchParams; money: string }) {
  const total = (key: string) => report.columns.find(column => column.key === key)?.total ?? null;
  const shown = cards.filter(card => card.key !== "period" || report.columns.some(column => column.key === "period"));
  const overdue = total("overdue");
  const toggle = (key: string) => summaryHref(params, { money: money === key ? null : key }, "#projects");
  return <section aria-label="สรุปยอดตามตัวกรอง" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
    {shown.map(({ key, label, hint, icon: Icon, tile, isFilter }) => {
      const isOn = money === key;
      const body = <>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn("grid size-7 flex-none place-items-center rounded-md", tile)} aria-hidden="true"><Icon className="size-4" /></span>{label}
        </span>
        <strong className="max-w-full text-xl tabular-nums [overflow-wrap:anywhere]">{displayAmount(total(key))}</strong>
        <span className="text-xs leading-snug text-muted-foreground">{hint}</span>
      </>;
      const bodyClass = cn("flex flex-col items-start gap-1 rounded-md text-start text-inherit no-underline", focusRing);
      return <div key={key} className={cn("flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4", isOn && "border-2 border-primary bg-primary-tint")}>
        {isFilter
          ? <Link className={bodyClass} href={toggle(key)} prefetch={false} aria-current={isOn ? "true" : undefined}>{body}</Link>
          : <div className="flex flex-col items-start gap-1">{body}</div>}
        {key === "billed" && overdue !== null && overdue > BigInt(0) && <Link prefetch={false} href={toggle("overdue")} aria-current={money === "overdue" ? "true" : undefined}
          className={cn(pillClass, "self-start font-bold", money === "overdue" ? "border-destructive bg-destructive text-primary-foreground" : "border-danger-ink/40 bg-danger-tint text-danger-ink")}>
          เกินกำหนด {displayAmount(overdue)} ›</Link>}
      </div>;
    })}
  </section>;
}

// Closeout is shown only when something is owed, and stays clickable while another money filter hides those projects.
export function CloseoutChip({ amount, params, money }: { amount: bigint; params: URLSearchParams; money: string }) {
  if (amount <= BigInt(0)) return null;
  return <div className="flex flex-wrap items-center gap-2 text-sm">
    <span className="text-muted-foreground">โครงการที่ปิดงานแล้ว</span>
    <Link prefetch={false} href={summaryHref(params, { money: money === "closeout" ? null : "closeout" }, "#projects")} aria-current={money === "closeout" ? "true" : undefined}
      className={cn(pillClass, money === "closeout" ? "border-primary bg-primary-tint font-semibold text-primary" : "border-line-strong bg-card text-foreground")}>
      ค้างตามข้อตกลงปิดงาน {displayAmount(amount)}</Link>
    {money && <Link prefetch={false} href={summaryHref(params, { money: null }, "#projects")} className={cn("inline-flex min-h-8 items-center px-2 font-semibold text-primary", focusRing)}>ดูทุกโครงการ</Link>}
  </div>;
}
