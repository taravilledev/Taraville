import Link from "next/link";
import type { ReactNode } from "react";
import { brandLabels, caseStatusLabels, type SalesCase } from "@/lib/sales/models";
import type { NextStep } from "@/lib/sales/case-progress";
import { taskHref } from "@/lib/sales/tasks";
import { formatMoney } from "@/lib/sales/money";
import { pageHeaderClass } from "@/components/page-header";
import { tagClass } from "@/components/tag";
import { buttonVariants } from "@/components/ui/button";
import { statCardsClass } from "@/components/stat-cards";
import { StepBlockedNotice } from "./step-blocked-notice";

const stepsClass = "m-0 flex list-none flex-wrap gap-2 p-0 [&_li]:rounded-full [&_li]:border [&_li]:px-4 [&_li]:py-1 [&_li]:text-sm [&_li]:text-muted-foreground " +
  "[&_li[data-done=true]]:bg-accent [&_li[data-done=true]]:text-foreground [&_li[aria-current=step]]:border-primary [&_li[aria-current=step]]:bg-primary [&_li[aria-current=step]]:font-bold [&_li[aria-current=step]]:text-primary-foreground";
const nextClass = "grid justify-items-start gap-3 rounded-lg border border-l-[6px] border-primary bg-card p-6 data-[done=true]:border-border [&_h2]:m-0 [&_h2]:text-lg [&_p]:m-0";
const stages = {
  TARAVILLE: ["draft", "reserved", "contracted", "completed"],
  BAAN_KUNAPAP: ["draft", "contracted", "completed"],
} as const;
type Summary = { net: string | null; received: string; outstanding: string | null };

export function CaseHeader({ sale, summary, step, workflow, navigation, showProgress = true, isExecutive = false }: {
  sale: SalesCase; summary: Summary | null; step: NextStep | null; workflow?: ReactNode; navigation?: ReactNode; showProgress?: boolean; isExecutive?: boolean;
}) {
  const flow: readonly string[] = stages[sale.brand];
  const current = flow.indexOf(sale.status);
  const money = (value: string | null) => value === null ? "—" : `${formatMoney(value)} บาท`;
  return <>
    <div className={pageHeaderClass}>
      <div><p className="text-sm text-muted-foreground">{brandLabels[sale.brand]}{sale.unit_label ? ` · ${sale.unit_label}` : ""}</p><h1>{sale.code} · {sale.customer_name}</h1></div>
      <div className="flex flex-wrap items-center gap-3"><span className={tagClass}>{caseStatusLabels[sale.status]}</span><Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/dashboard" prefetch={false}>กลับแดชบอร์ด</Link></div>
    </div>
    {navigation}
    {showProgress && !workflow && current >= 0 && <ol className={stepsClass} aria-label="สถานะงาน">{flow.map((status, index) =>
      <li key={status} aria-current={index === current ? "step" : undefined} data-done={index < current}>{caseStatusLabels[status as SalesCase["status"]]}</li>)}</ol>}
    {summary && <dl className={statCardsClass}>
      <div><dt>{sale.brand === "BAAN_KUNAPAP" ? "มูลค่าโครงการ (ราคาสุทธิ)" : "ราคาสุทธิ"}</dt><dd>{money(summary.net)}</dd></div>
      <div><dt>รับแล้ว (หลังหักคืนเงิน)</dt><dd>{money(summary.received)}</dd></div>
      <div><dt>ค้างชำระ</dt><dd>{money(summary.outstanding)}</dd></div>
    </dl>}
    {showProgress && (workflow ?? (summary && <NextStepCard sale={sale} step={step} isExecutive={isExecutive} />))}
  </>;
}

function NextStepCard({ sale, step, isExecutive }: { sale: SalesCase; step: NextStep | null; isExecutive: boolean }) {
  if (!step) return null;
  return <section className={nextClass} data-done={step.kind === "done"} aria-labelledby="next-step">
    <p className="text-sm text-muted-foreground">{step.kind === "done" ? "สถานะ" : "ขั้นต่อไป"}</p>
    <h2 id="next-step">{step.title}</h2>
    {step.hint && <p className="text-sm text-muted-foreground">{step.hint}</p>}
    {step.kind !== "done" && step.allowed && <Link className={buttonVariants({ size: "auto" })} prefetch={false}
      href={step.task ? taskHref(sale.id, step.task, step.row) : `/sales/${sale.id}?tab=${step.tab}${step.anchor ? `#${step.anchor}` : ""}`}>{step.kind === "reserve" ? "ยืนยันจองแปลง" : "ไปทำขั้นนี้"}</Link>}
    {!step.allowed && <StepBlockedNotice isExecutive={isExecutive} />}
  </section>;
}
