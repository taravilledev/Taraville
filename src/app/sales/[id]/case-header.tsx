import Link from "next/link";
import type { ReactNode } from "react";
import { brandLabels, caseStatusLabels, type SalesCase } from "@/lib/sales/models";
import type { NextStep } from "@/lib/sales/case-progress";
import { taskHref } from "@/lib/sales/tasks";
import { formatMoney } from "@/lib/sales/money";
import styles from "../sales.module.css";
import { tagClass } from "@/components/tag";
import { buttonVariants } from "@/components/ui/button";

const stages = {
  TARAVILLE: ["draft", "reserved", "contracted", "completed"],
  BAAN_KUNAPAP: ["draft", "contracted", "completed"],
} as const;
type Summary = { net: string | null; received: string; outstanding: string | null };

export function CaseHeader({ sale, summary, step, workflow, navigation, showProgress = true }: {
  sale: SalesCase; summary: Summary | null; step: NextStep | null; workflow?: ReactNode; navigation?: ReactNode; showProgress?: boolean;
}) {
  const flow: readonly string[] = stages[sale.brand];
  const current = flow.indexOf(sale.status);
  const money = (value: string | null) => value === null ? "—" : `${formatMoney(value)} บาท`;
  return <>
    <div className={styles.header}>
      <div><p className={styles.muted}>{brandLabels[sale.brand]}{sale.unit_label ? ` · ${sale.unit_label}` : ""}</p><h1>{sale.code} · {sale.customer_name}</h1></div>
      <div className="flex flex-wrap items-center gap-3"><span className={tagClass}>{caseStatusLabels[sale.status]}</span><Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/dashboard" prefetch={false}>กลับแดชบอร์ด</Link></div>
    </div>
    {navigation}
    {showProgress && !workflow && current >= 0 && <ol className={styles.steps} aria-label="สถานะงาน">{flow.map((status, index) =>
      <li key={status} aria-current={index === current ? "step" : undefined} data-done={index < current}>{caseStatusLabels[status as SalesCase["status"]]}</li>)}</ol>}
    {summary && <dl className={styles.summary}>
      <div><dt>{sale.brand === "BAAN_KUNAPAP" ? "มูลค่าโครงการ (ราคาสุทธิ)" : "ราคาสุทธิ"}</dt><dd>{money(summary.net)}</dd></div>
      <div><dt>รับแล้ว (หลังหักคืนเงิน)</dt><dd>{money(summary.received)}</dd></div>
      <div><dt>ค้างชำระ</dt><dd>{money(summary.outstanding)}</dd></div>
    </dl>}
    {showProgress && (workflow ?? (summary && <NextStepCard sale={sale} step={step} />))}
  </>;
}

function NextStepCard({ sale, step }: { sale: SalesCase; step: NextStep | null }) {
  if (!step) return null;
  return <section className={styles.next} data-done={step.kind === "done"} aria-labelledby="next-step">
    <p className={styles.muted}>{step.kind === "done" ? "สถานะ" : "ขั้นต่อไป"}</p>
    <h2 id="next-step">{step.title}</h2>
    {step.hint && <p className={styles.muted}>{step.hint}</p>}
    {step.kind !== "done" && step.allowed && <Link className={buttonVariants({ size: "auto" })} prefetch={false}
      href={step.task ? taskHref(sale.id, step.task, step.row) : `/sales/${sale.id}?tab=${step.tab}${step.anchor ? `#${step.anchor}` : ""}`}>{step.kind === "reserve" ? "ยืนยันจองแปลง" : "ไปทำขั้นนี้"}</Link>}
    {!step.allowed && <p className={styles.muted}>รอผู้มีสิทธิ์ดำเนินการขั้นนี้ บัญชีของคุณไม่มีสิทธิ์</p>}
  </section>;
}
