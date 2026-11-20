import Link from "next/link";
import { bkpOverviewStage, bkpOverviewStages, bkpWorkflow } from "@/lib/sales/bkp-workflow";
import type { NextStep } from "@/lib/sales/case-progress";
import { nextDesignPayment } from "@/lib/sales/design-fees";
import { findTask, taskHref } from "@/lib/sales/tasks";
import type { SummaryData } from "./summary-sections";
import * as styles from "./bkp-workflow-styles";
import { QuotationSection } from "./quotation-section";
import { ContractSection } from "./contract-section";
import { WorkspaceHeading } from "./workspace-heading";
import { StepBlockedNotice } from "./step-blocked-notice";
import { formatMoney } from "@/lib/sales/money";
import { panelClass } from "@/components/panel";
import { buttonVariants } from "@/components/ui/button";
import { statCardsClass } from "@/components/stat-cards";
import { cn } from "@/lib/utils";

export function BkpOverview({ data, step, isExecutive = false }: { data: SummaryData; step: NextStep | null; isExecutive?: boolean }) {
  const { sale, finance, agreement } = data;
  if (!finance || !agreement) return null;
  const flow = bkpWorkflow(finance, agreement);
  const construction = data.summary?.net ?? null;
  const hasSeparateDesignFee = flow.contract?.payload.design_fee_separate === true;
  const design = hasSeparateDesignFee ? finance.design_plan?.total_cents ?? null : null;
  const projectValue = construction !== null && design !== null ? (BigInt(construction) + BigInt(design)).toString() : construction;
  const outstanding = hasSeparateDesignFee && flow.contract?.state !== "signed" && !data.closeout ? null : data.summary?.outstanding ?? null;
  const stageDone = {
    intake: true, design: flow.done.fees, quotation: flow.done.quotation,
    contract: flow.contract?.state === "signed", money: flow.done.contract,
  };
  const current = bkpOverviewStage(flow);
  // Paid instalments come from the same net received total that marks the fee stage done.
  const instalments = finance.design_plan?.instalments ?? [];
  const feeCount = instalments.filter(amount => amount !== "0").length;
  const nextFee = nextDesignPayment(instalments, flow.received);
  const feePaid = nextFee ? instalments.slice(0, nextFee.position - 1).filter(amount => amount !== "0").length : feeCount;
  const isFinanceStep = step?.tab === "money";
  const task = step?.task ? findTask(data.tasks, step.task, step.row) : null;
  return <>
    <WorkspaceHeading caseId={sale.id} title="ภาพรวมโครงการ" description="มูลค่า ความคืบหน้า และงานที่ต้องทำต่อของโครงการนี้" />
    {data.summary && <dl className={statCardsClass}>
      <div><dt>มูลค่าโครงการ (ราคาสุทธิ)</dt><dd>{projectValue === null ? "ยังไม่ระบุ" : `${formatMoney(projectValue)} บาท`}
        {construction !== null && design !== null && <p className="text-sm text-muted-foreground">ค่าก่อสร้าง {formatMoney(construction)} + ค่าออกแบบ {formatMoney(design)} บาท</p>}</dd></div>
      <div><dt>รับแล้วหลังหักคืนเงิน</dt><dd>{formatMoney(data.summary.received)} บาท</dd></div>
      <div><dt>{hasSeparateDesignFee && !data.closeout ? "ค้างชำระค่าก่อสร้าง" : "ค้างชำระ"}</dt><dd>{outstanding === null ? "ยังไม่ระบุ" : `${formatMoney(outstanding)} บาท`}</dd></div>
    </dl>}
    {sale.status !== "cancelled" && <section className={styles.flow} aria-label="สถานะโครงการ">
      <ol className={styles.stages}>{Object.entries(bkpOverviewStages).map(([id, label], index) => {
        const isDone = stageDone[id as keyof typeof stageDone];
        return <li key={id} aria-current={!isDone && current === id ? "step" : undefined}>
          <span className={styles.number}>{index + 1}</span>
          <span><strong>{label}</strong><small>{isDone ? "เสร็จแล้ว" : current === id ? "กำลังดำเนินการ" : "ยังไม่เสร็จ"}</small>
            {id === "design" && feeCount > 0 && <small>ค่าแบบ {feePaid}/{feeCount} งวด</small>}</span>
        </li>;
      })}</ol>
    </section>}
    <section className={cn(panelClass, styles.context)}>
      <div><h2>งานถัดไป</h2><p>{step?.title ?? "ไม่มีงานถัดไปในขณะนี้"}</p>
        {step?.hint && <p className="text-sm text-muted-foreground">{step.hint}</p>}
        {step && !step.allowed && <StepBlockedNotice isExecutive={isExecutive} />}
      </div>
      {step?.allowed && step.kind !== "done" && (!step.task || task) && <Link className={buttonVariants({ size: "auto" })} prefetch={false}
        href={task && !isFinanceStep ? taskHref(sale.id, task.name, task.row) : `/sales/${sale.id}?tab=${step.tab}${step.anchor ? `#${step.anchor}` : ""}`}>
        {isFinanceStep ? "ไปหน้าการเงิน" : "ไปทำงานถัดไป"}
      </Link>}
    </section>
  </>;
}

export function BkpAgreementSection({ data, tab }: { data: SummaryData; tab: "quotation" | "contract" }) {
  const { finance, agreement } = data;
  if (!finance || !agreement) return null;
  return <>
    {tab === "quotation" && <QuotationSection data={data} />}
    {tab === "contract" && <ContractSection data={data} />}
  </>;
}
