import Link from "next/link";
import { PAGE_SIZE, listHref, pageWindow, type LeadFilters } from "@/lib/walkin/lead-list";
import styles from "./leads.module.css";

export function ListPager({ filters, total }: { filters: LeadFilters; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (!total) return null;
  const first = (filters.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, filters.page * PAGE_SIZE);
  const href = (page: number) => listHref(filters, { page });
  return <div className={styles.pagerWrap}>
    <p className={styles.pagerSummary}>แสดง {first.toLocaleString("th-TH")}–{last.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")}</p>
    {totalPages > 1 && <nav className={styles.pager} aria-label="เปลี่ยนหน้ารายการ">
    {filters.page > 1 && <Link href={href(filters.page - 1)} prefetch={false}>← ก่อนหน้า</Link>}
    {pageWindow(filters.page, totalPages).map((number, index) => number === null
      ? <span key={`gap-${index}`} aria-hidden>…</span>
      : <Link key={number} href={href(number)} prefetch={false} aria-current={number === filters.page ? "page" : undefined}
        className={number === filters.page ? styles.currentPage : undefined}>{number}</Link>)}
    {filters.page < totalPages && <Link href={href(filters.page + 1)} prefetch={false}>ถัดไป →</Link>}
  </nav>}
  </div>;
}
