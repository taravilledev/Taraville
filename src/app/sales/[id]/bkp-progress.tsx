import Link from "next/link";
import { Check, Circle, CircleDot } from "lucide-react";
import type { SalesCase } from "@/lib/sales/models";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { NextStep, ProjectProgress } from "@/lib/sales/case-progress";
import { bkpChecklist, type ChecklistItem } from "@/lib/sales/bkp-checklist";
import { findTask, taskHref, taskLabels, type Task } from "@/lib/sales/tasks";
import { formatMoney } from "@/lib/sales/money";
import { bkpFlowStages, bkpWorkflow } from "@/lib/sales/bkp-workflow";
import styles from "./bkp-progress.module.css";
import shared from "../sales.module.css";
import { buttonVariants } from "@/components/ui/button";

type Props = { sale: SalesCase; finance: FinancialDetail; agreement: AgreementDetail; progress: ProjectProgress;
  step: NextStep | null; tasks: Task[]; activeTask?: Task; compact?: boolean };

export function BkpProgress({ sale, finance, agreement, progress, step, tasks, activeTask, compact }: Props) {
  const checklist = bkpChecklist({ hasDesignPlan: !!finance.design_plan, documents: agreement.documents, instalments: agreement.instalments });
  const row = checklist.currentRow;
  const isCollecting = progress.current === 4;
  const isCurrentTask = !!activeTask && step?.task === activeTask.name && step.row === activeTask.row;
  const href = step?.task ? taskHref(sale.id, step.task, step.row) : `/sales/${sale.id}?tab=${step?.tab ?? "money"}${step?.anchor ? `#${step.anchor}` : ""}`;
  const flow = bkpWorkflow(finance, agreement);
  const currentStage = bkpFlowStages.findIndex(stage => stage.id === flow.current);
  if (compact) return <section className={styles.compact} aria-label="สรุปสถานะโครงการ"><p><strong>{agreement.is_settled ? "ชำระครบทุกงวดแล้ว" : `ขั้นที่ ${currentStage + 1} จาก ${bkpFlowStages.length} · ${bkpFlowStages[currentStage].label}`}</strong>{(activeTask || step) && <span> · {activeTask ? taskLabels[activeTask.name] : step?.title}</span>}</p>
    <Link href={`/sales/${sale.id}?tab=overview`} prefetch={false}>ดูการติดตามโครงการ →</Link></section>;
  const items = (checks: ChecklistItem[]) => <ul className={styles.checks}>{checks.map((item, index) => {
    const task = !item.done && findTask(tasks, item.task, item.row);
    const isOpen = !!activeTask && activeTask.name === item.task
      && (item.task === "accept-quotation" || activeTask.row === item.row);
    const documentHref = item.documentId ? `/sales/documents/${item.documentId}` : undefined;
    const target = !item.done && task && !isOpen ? taskHref(sale.id, task.name, task.row) : undefined;
    const Icon = isOpen ? CircleDot : item.done ? Check : Circle;
    return <li key={index} data-done={item.done} aria-current={isOpen ? "step" : undefined}><Icon size={18} aria-hidden="true" />
      <span>{target ? <Link href={target} prefetch={false}>{item.label}</Link> : item.label}
        <small>{isOpen ? "กำลังทำรายการนี้" : item.done ? "เสร็จแล้ว" : "รอดำเนินการ"}</small></span>
      {item.done && documentHref && <Link className={styles.documentLink} href={documentHref} prefetch={false}>ดูเอกสาร</Link>}</li>;
  })}</ul>;
  return <section className={styles.card} aria-labelledby="project-progress">
    <div className={styles.heading}><div><p className={shared.muted}>งานขายและรับชำระ · ช่วงที่ {progress.current + 1} จาก {progress.steps.length}</p>
      <h2 id="project-progress">{agreement.is_settled ? "ชำระครบทุกงวดแล้ว" : `สถานะโครงการ · ${progress.steps[progress.current]}`}</h2></div></div>
    <ol className={styles.stages} aria-label="ความคืบหน้างานขายและรับชำระ">{progress.steps.map((label, index) => {
      const done = index === 4 ? agreement.is_settled : checklist.milestones[index];
      return <li key={index} aria-current={index === progress.current && !progress.complete ? "step" : undefined} data-done={done}>
        <span className={styles.marker}>{done ? <Check size={16} aria-hidden="true" /> : index + 1}</span><span>{label}
          <small>{done ? "เสร็จแล้ว" : index === progress.current ? "กำลังดำเนินการ" : "รอดำเนินการ"}</small></span></li>;
    })}</ol>
    {step && <div className={styles.action}>
      <div><p className={shared.muted}>{isCurrentTask ? "กำลังทำรายการนี้" : step.kind === "done" ? "สถานะล่าสุด" : "งานที่ต้องทำตอนนี้"}</p>
        <h3>{step.title}</h3>{step.hint && <p>{step.hint}</p>}
        {!step.allowed && <p className={shared.muted}>รอผู้มีสิทธิ์ดำเนินการ บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้</p>}</div>
      {step.kind !== "done" && step.allowed && !isCurrentTask && <Link className={buttonVariants({ size: "auto" })} href={href} prefetch={false}>
        {step.task ? taskLabels[step.task] : step.title}</Link>}
    </div>}
    <div className={styles.body}>
      <div><h3>{isCollecting ? row ? `ติดตามงวด · ${row.label}` : "งวดชำระตามสัญญา" : "รายการงานก่อนรับชำระตามสัญญา"}</h3>
        {isCollecting && row && <p className={shared.muted}>ยอดสุทธิ {formatMoney(row.net)} · คงเหลือ {formatMoney(row.outstanding)} บาท</p>}
        {isCollecting ? row ? items(row.checks) : <p className={shared.muted}>ยังไม่มีข้อมูลงวดชำระ</p> : items(checklist.preparation)}
      </div>
      {isCollecting && checklist.rows.length > 0 && <details className={styles.details}>
        <summary>ดูทุกงวด · เสร็จ {checklist.rows.filter(item => item.done).length} จาก {checklist.rows.length} งวด</summary>
        <ol className={styles.rows}>{checklist.rows.map(item => <li key={item.id}><h4>{item.label}</h4>
          <p className={shared.muted}>ยอดสุทธิ {formatMoney(item.net)} · คงเหลือ {formatMoney(item.outstanding)} บาท</p>{items(item.checks)}</li>)}</ol>
      </details>}
    </div>
    <div className={styles.shortcuts}>
      <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}?tab=money`} prefetch={false}>การเงิน · ค่าแบบ งวด และใบเสร็จ</Link>
    </div>
  </section>;
}
