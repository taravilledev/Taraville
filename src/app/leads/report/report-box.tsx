import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const boxClass = "flex min-w-0 flex-col gap-2 rounded-lg border bg-card px-4 py-3.5";
export const rowClass = "flex min-h-9 items-center justify-between gap-3 border-t text-sm";

/** Marks a number as team-wide when a Sale sees counts wider than their own rows (ADR 0015). */
export function TeamTag() {
  return <span className="rounded-full bg-secondary px-2 py-px text-xs font-semibold text-muted-foreground">ทั้งทีม</span>;
}

export function ReportBox({ title, isTeam, className, children }: { title: string; isTeam?: boolean; className?: string; children: ReactNode }) {
  return <div className={cn(boxClass, className)}>
    <h2 className="m-0 flex items-center gap-2 text-sm font-bold">{title}{isTeam && <TeamTag />}</h2>
    {children}
  </div>;
}

export function CountRow({ label, count, mark }: { label: string; count: number; mark?: ReactNode }) {
  return <li className={rowClass}>
    <span className="inline-flex items-center gap-2">{mark}{label}</span>
    <b className="tabular-nums">{count.toLocaleString("th-TH")}</b>
  </li>;
}
