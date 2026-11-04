import Link from "next/link";
import { brandLabels, caseStatusLabels, type SalesCase } from "@/lib/sales/models";
import type { NextStep } from "@/lib/sales/case-progress";
import { formatMoney } from "@/lib/sales/money";
import { ReserveForm } from "./adjustment-panel";
import styles from "../sales.module.css";

const stages = {
  TARAVILLE: ["draft", "reserved", "contracted", "completed"],
  BAAN_KUNAPAP: ["draft", "contracted", "completed"],
} as const;
type Summary = { net: string | null; received: string; outstanding: string | null };

export function CaseHeader({ sale, summary, step }: { sale: SalesCase; summary: Summary | null; step: NextStep | null }) {
  const flow: readonly string[] = stages[sale.brand];
  const current = flow.indexOf(sale.status);
  const money = (value: string | null) => value === null ? "—" : `${formatMoney(value)} บาท`;
  return <>
    <div className={styles.header}>
      <div><p className={styles.muted}>{brandLabels[sale.brand]}{sale.unit_label ? ` · ${sale.unit_label}` : ""}</p><h1>{sale.code} · {sale.customer_name}</h1></div>
      <div className={styles.links}><span className={styles.tag}>{caseStatusLabels[sale.status]}</span><Link className={styles.link} href="/sales" prefetch={false}>กลับรายการงาน</Link></div>
    </div>
    {current >= 0 && <ol className={styles.steps} aria-label="สถานะงาน">{flow.map((status, index) =>
      <li key={status} aria-current={index === current ? "step" : undefined} data-done={index < current}>{caseStatusLabels[status as SalesCase["status"]]}</li>)}</ol>}
    {summary && <dl className={styles.summary}>
      <div><dt>ราคาสุทธิ</dt><dd>{money(summary.net)}</dd></div>
      <div><dt>รับแล้ว (หลังหักคืนเงิน)</dt><dd>{money(summary.received)}</dd></div>
      <div><dt>ค้างชำระ</dt><dd>{money(summary.outstanding)}</dd></div>
    </dl>}
    {summary && <NextStepCard sale={sale} step={step} />}
  </>;
}

function NextStepCard({ sale, step }: { sale: SalesCase; step: NextStep | null }) {
  if (!step) return null;
  return <section className={styles.next} data-done={step.kind === "done"} aria-labelledby="next-step">
    <p className={styles.muted}>{step.kind === "done" ? "สถานะ" : "ขั้นต่อไป"}</p>
    <h2 id="next-step">{step.title}</h2>
    {step.hint && <p className={styles.muted}>{step.hint}</p>}
    {step.kind === "reserve" && step.allowed && <ReserveForm sale={sale} />}
    {step.kind !== "reserve" && step.kind !== "done" && step.allowed && <Link className={styles.primary} prefetch={false}
      href={`/sales/${sale.id}?tab=${step.tab}${step.anchor ? `#${step.anchor}` : ""}`}>ไปทำขั้นนี้</Link>}
    {!step.allowed && <p className={styles.muted}>รอผู้มีสิทธิ์ดำเนินการขั้นนี้ บัญชีของคุณไม่มีสิทธิ์</p>}
  </section>;
}
