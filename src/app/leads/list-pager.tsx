import Link from "next/link";
import { PAGE_SIZE, listHref, pageWindow, type LeadFilters } from "@/lib/walkin/lead-list";
import { cn } from "@/lib/utils";

const pageLinkClass = "inline-flex min-h-(--tap-min) min-w-(--tap-min) items-center justify-center rounded-sm px-3 text-primary no-underline";

export function ListPager({ filters, total }: { filters: LeadFilters; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (!total) return null;
  const first = (filters.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, filters.page * PAGE_SIZE);
  const href = (page: number) => listHref(filters, { page });
  return <div className="my-6 flex flex-col items-center gap-2">
    <p className="m-0 text-sm text-muted-foreground">แสดง {first.toLocaleString("th-TH")}–{last.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")}</p>
    {totalPages > 1 && <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="เปลี่ยนหน้ารายการ">
    {filters.page > 1 && <Link href={href(filters.page - 1)} prefetch={false} className={pageLinkClass}>← ก่อนหน้า</Link>}
    {pageWindow(filters.page, totalPages).map((number, index) => number === null
      ? <span key={`gap-${index}`} aria-hidden>…</span>
      : <Link key={number} href={href(number)} prefetch={false} aria-current={number === filters.page ? "page" : undefined}
        className={cn(pageLinkClass, number === filters.page && "bg-primary font-bold text-primary-foreground")}>{number}</Link>)}
    {filters.page < totalPages && <Link href={href(filters.page + 1)} prefetch={false} className={pageLinkClass}>ถัดไป →</Link>}
  </nav>}
  </div>;
}
