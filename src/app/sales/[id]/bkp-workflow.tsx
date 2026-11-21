import { bkpWorkflow } from "@/lib/sales/bkp-workflow";
import type { SummaryData } from "./summary-sections";
import { QuotationSection } from "./quotation-section";
import { ContractSection } from "./contract-section";
import type { TaskData } from "./tasks/task-data";
import { WorkspaceHeading } from "./workspace-heading";
import { formatMoney } from "@/lib/sales/money";
import { statCardsClass } from "@/components/stat-cards";

export function BkpOverview({ data }: { data: SummaryData }) {
  const { sale, finance, agreement } = data;
  if (!finance || !agreement) return null;
  const flow = bkpWorkflow(finance, agreement);
  const construction = data.summary?.net ?? null;
  const hasSeparateDesignFee = flow.contract?.payload.design_fee_separate === true;
  const design = hasSeparateDesignFee ? finance.design_plan?.total_cents ?? null : null;
  const projectValue = construction !== null && design !== null ? (BigInt(construction) + BigInt(design)).toString() : construction;
  const outstanding = hasSeparateDesignFee && flow.contract?.state !== "signed" && !data.closeout ? null : data.summary?.outstanding ?? null;
  return <>
    <WorkspaceHeading caseId={sale.id} title="ภาพรวมโครงการ" description="มูลค่าและยอดรับชำระของโครงการนี้" />
    {data.summary && <dl className={statCardsClass}>
      <div><dt>มูลค่าโครงการ (ราคาสุทธิ)</dt><dd>{projectValue === null ? "ยังไม่ระบุ" : `${formatMoney(projectValue)} บาท`}
        {construction !== null && design !== null && <p className="text-sm text-muted-foreground">ค่าก่อสร้าง {formatMoney(construction)} + ค่าออกแบบ {formatMoney(design)} บาท</p>}</dd></div>
      <div><dt>รับแล้วหลังหักคืนเงิน</dt><dd>{formatMoney(data.summary.received)} บาท</dd></div>
      <div><dt>{hasSeparateDesignFee && !data.closeout ? "ค้างชำระค่าก่อสร้าง" : "ค้างชำระ"}</dt><dd>{outstanding === null ? "ยังไม่ระบุ" : `${formatMoney(outstanding)} บาท`}</dd></div>
    </dl>}
  </>;
}

export function BkpAgreementSection({ data, tab, contractTemplate, isExecutive }: { data: SummaryData; tab: "quotation" | "contract"; contractTemplate?: TaskData["contractTemplate"]; isExecutive?: boolean }) {
  const { finance, agreement } = data;
  if (!finance || !agreement) return null;
  return <>
    {tab === "quotation" && <QuotationSection data={data} />}
    {tab === "contract" && <ContractSection data={data} contractTemplate={contractTemplate} isExecutive={isExecutive} />}
  </>;
}
