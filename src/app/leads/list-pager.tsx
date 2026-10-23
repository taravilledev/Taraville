import Link from "next/link";
import { listHref, pageWindow, type LeadFilters } from "@/lib/walkin/lead-list";
import styles from "./leads.module.css";

export function ListPager({ filters, totalPages }: { filters: LeadFilters; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (page: number) => listHref(filters, { page });
  return <nav className={styles.pager} aria-label="เปลี่ยนหน้ารายการ">
    {filters.page > 1 && <Link href={href(filters.page - 1)} prefetch={false}>← ก่อนหน้า</Link>}
    {pageWindow(filters.page, totalPages).map((number, index) => number === null
      ? <span key={`gap-${index}`} aria-hidden>…</span>
      : <Link key={number} href={href(number)} prefetch={false} aria-current={number === filters.page ? "page" : undefined}
        className={number === filters.page ? styles.currentPage : undefined}>{number}</Link>)}
    {filters.page < totalPages && <Link href={href(filters.page + 1)} prefetch={false}>ถัดไป →</Link>}
  </nav>;
}
