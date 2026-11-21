import Link from "next/link";
import type { ReactNode } from "react";
import { brandLabels, caseStatusLabels, caseStatusTones, type SalesCase } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import { pageHeaderClass } from "@/components/page-header";
import { Status } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { statCardsClass } from "@/components/stat-cards";

const stepsClass = "m-0 flex list-none flex-wrap gap-2 p-0 [&_li]:rounded-full [&_li]:border [&_li]:px-4 [&_li]:py-1 [&_li]:text-sm [&_li]:text-muted-foreground " +
  "[&_li[data-done=true]]:bg-accent [&_li[data-done=true]]:text-foreground [&_li[aria-current=step]]:border-primary [&_li[aria-current=step]]:bg-primary [&_li[aria-current=step]]:font-bold [&_li[aria-current=step]]:text-primary-foreground";
const stages = {
  TARAVILLE: ["draft", "reserved", "contracted", "completed"],
  BAAN_KUNAPAP: ["draft", "contracted", "completed"],
} as const;
type Summary = { net: string | null; received: string; outstanding: string | null };

export function CaseHeader({ sale, summary, navigation, showProgress = true }: {
  sale: SalesCase; summary: Summary | null; navigation?: ReactNode; showProgress?: boolean;
}) {
  const flow: readonly string[] = stages[sale.brand];
  const current = flow.indexOf(sale.status);
  const money = (value: string | null) => value === null ? "—" : `${formatMoney(value)} บาท`;
  return <>
    <div className={pageHeaderClass}>
      <div><p className="text-sm text-muted-foreground">{brandLabels[sale.brand]}{sale.unit_label ? ` · ${sale.unit_label}` : ""}</p><h1>{sale.code} · {sale.customer_name}</h1></div>
      <div className="flex flex-wrap items-center gap-3"><Status tone={caseStatusTones[sale.status]}>{caseStatusLabels[sale.status]}</Status><Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/dashboard" prefetch={false}>กลับแดชบอร์ด</Link></div>
    </div>
    {navigation}
    {showProgress && current >= 0 && <ol className={stepsClass} aria-label="สถานะงาน">{flow.map((status, index) =>
      <li key={status} aria-current={index === current ? "step" : undefined} data-done={index < current}>{caseStatusLabels[status as SalesCase["status"]]}</li>)}</ol>}
    {summary && <dl className={statCardsClass}>
      <div><dt>{sale.brand === "BAAN_KUNAPAP" ? "มูลค่าโครงการ (ราคาสุทธิ)" : "ราคาสุทธิ"}</dt><dd>{money(summary.net)}</dd></div>
      <div><dt>รับแล้ว (หลังหักคืนเงิน)</dt><dd>{money(summary.received)}</dd></div>
      <div><dt>ค้างชำระ</dt><dd>{money(summary.outstanding)}</dd></div>
    </dl>}
  </>;
}
