import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared table pattern (design-system §8): sortable header, sticky header, whole-row link, cards when narrow.
// The card switch follows the table's own width, not the screen's, because the sidebar takes a share of it.
// The header sticks to the page, so nothing between it and the window may scroll or clip.
const tableClass =
  "w-full border-separate border-spacing-0 text-sm " +
  "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-1 [&_thead_th]:border-b [&_thead_th]:bg-accent [&_thead_th]:px-3 [&_thead_th]:py-2.5 [&_thead_th]:text-start [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:text-muted-foreground " +
  "[&_thead_th:first-child]:rounded-ss-lg [&_thead_th:last-child]:rounded-se-lg " +
  "[&_tbody_td]:border-b [&_tbody_td]:px-3 [&_tbody_td]:py-2.5 [&_tbody_td]:align-middle [&_tbody_tr:last-child_td]:border-b-0 " +
  "@max-[768px]/data-table:block " +
  "@max-[768px]/data-table:[&_thead]:absolute @max-[768px]/data-table:[&_thead]:size-px @max-[768px]/data-table:[&_thead]:overflow-hidden @max-[768px]/data-table:[&_thead]:[clip-path:inset(50%)] " +
  // minmax(0,1fr) and min-w-0 keep nowrap cell text from widening a card past the screen.
  "@max-[768px]/data-table:[&_tbody]:grid @max-[768px]/data-table:[&_tbody]:grid-cols-[minmax(0,1fr)] @max-[768px]/data-table:[&_tbody]:gap-3 " +
  "@max-[768px]/data-table:[&_tr]:min-w-0 @max-[768px]/data-table:[&_tr]:flex @max-[768px]/data-table:[&_tr]:flex-wrap @max-[768px]/data-table:[&_tr]:items-center @max-[768px]/data-table:[&_tr]:gap-x-2 @max-[768px]/data-table:[&_tr]:gap-y-2 " +
  "@max-[768px]/data-table:[&_tr]:rounded-lg @max-[768px]/data-table:[&_tr]:border @max-[768px]/data-table:[&_tr]:bg-card @max-[768px]/data-table:[&_tr]:p-3 " +
  "@max-[768px]/data-table:[&_td]:min-w-0 @max-[768px]/data-table:[&_td]:border-0 @max-[768px]/data-table:[&_td]:p-0"

export function DataTable({ label, children }: { label: string; children: ReactNode }) {
  return <div className="@container/data-table">
    <div className="rounded-lg border bg-card @max-[768px]/data-table:border-0 @max-[768px]/data-table:bg-transparent">
      <table className={tableClass} aria-label={label}>{children}</table>
    </div>
  </div>;
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2";

/** A column header that sorts: `direction` is the current sort on this column, `href` the link that flips it. */
export function SortHeader({ href, direction, children }: { href: string; direction?: "asc" | "desc"; children: ReactNode }) {
  return <th scope="col" aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}>
    <Link className={cn("inline-flex items-center gap-1 text-foreground hover:text-primary", focusRing)} href={href} prefetch={false}>
      {children} <span aria-hidden="true">{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span>
    </Link>
  </th>;
}

/** A body row that opens its record anywhere you click it; put one RowLink inside. */
export function DataRow({ children }: { children: ReactNode }) {
  return <tr className="relative hover:bg-accent">{children}</tr>;
}

/** The link that stretches over its DataRow, so the whole row is the click target. */
export function RowLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return <Link className={cn("no-underline after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-primary focus-visible:after:-outline-offset-2", className)} href={href} prefetch={false}>{children}</Link>;
}
