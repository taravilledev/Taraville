import { Suspense } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { salesCase } from "@/lib/sales/queries";
import { loadCaseData } from "@/lib/sales/case-loader";
import { bkpCaseTabs, resolveCaseTab, taskReturnTab } from "@/lib/sales/case-navigation";
import { type CaseTab } from "@/lib/sales/case-progress";
import { availableTasks, findTask, type TaskName } from "@/lib/sales/tasks";
import { taskContext } from "@/lib/sales/task-context";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { CaseHeader } from "./case-header";
import { BkpOverview, BkpAgreementSection } from "./bkp-workflow";
import { StageBar, stageTabs } from "./stage-bar";
import { StageNextStep } from "./stage-next-step";
import { designFeeNote } from "./design-fee-note";
import { HouseBriefPanel } from "./house-brief-panel";
import { DesignBillingPanel } from "./design-billing-panel";
import { DocumentsSection, MoneySection, OverviewSection } from "./summary-sections";
import { BkpMoneySection } from "./bkp-money-section";
import { TaskView } from "./tasks/task-view";
import { usesFocusedTaskHeader } from "./tasks/task-header";
import { Status } from "@/components/status";
import { noticeClass } from "@/components/notice";
import { FixNotice } from "@/components/fix-notice";
import { CancelProjectSection } from "@/app/walkin/cancel-project-section";
import { guidance } from "@/lib/errors/error-map";
import { missingContractPrerequisite } from "@/lib/sales/contract-template";

export const metadata = { title: "ข้อมูลงานและรายการขาย · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const drawerTasks: Partial<Record<TaskName, { tab: CaseTab; name: string }>> = { "accept-quotation": { tab: "quotation", name: "accept" },
  "sign-contract": { tab: "contract", name: "sign" }, "unlock-contract": { tab: "contract", name: "unlock" },
  "confirm-payment": { tab: "money", name: "confirm-payment" }, "withdraw-payment": { tab: "money", name: "withdraw-payment" }, acceptance: { tab: "money", name: "acceptance" },
  "request-refund": { tab: "money", name: "request-refund" }, "decide-refund": { tab: "money", name: "decide-refund" }, "pay-refund": { tab: "money", name: "pay-refund" } };
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

// Plot status from the reservation read; the "taken by another project" state has no data on this page, so it is not drawn.
function plotStatus(status: string, reservation: { active: boolean } | null) {
  if (!reservation) return null;
  if (reservation.active) return <div><Status tone="success">จองแล้ว · กันให้โครงการนี้</Status></div>;
  return status === "draft" ? <div><Status tone="waiting">ว่าง · ร่างยังไม่กันแปลง</Status></div> : null;
}

export default function CasePage(props: Props) { return <Suspense fallback={<PageSkeleton />}><CaseDetail {...props} /></Suspense>; }
async function CaseDetail({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const { staff, sale, supabase } = await salesCase(id);
  const { work, finance, agreement, closeout, reservation, refunds, summary, step, progress } = await loadCaseData(supabase, sale);
  const assignments = sale.can_assign ? await supabase.from("staff").select("id,full_name").eq("is_active", true).order("full_name") : { data: [], error: null };
  if (assignments.error) throw new Error("โหลดผู้รับผิดชอบไม่ได้ กรุณาลองใหม่");
  const owners = z.object({ id: z.uuid(), full_name: z.string() }).array().parse(assignments.data);
  const tasks = availableTasks(taskContext({ sale, finance, agreement, refunds, staffId: staff.id, reservation, work }));
  const name = one(query.task);
  const task = name ? findTask(tasks, name, one(query.row)) : undefined;
  // A stale or no-longer-allowed task link returns to the summary with the reason.
  if (name && !task) redirect(`/sales/${sale.id}?notice=task`);
  // On BKP these short forms live in a drawer on their stage tab; the next-step card and old links land there.
  const drawer = task && drawerTasks[task.name];
  if (drawer && sale.brand === "BAAN_KUNAPAP" && sale.can_finance) redirect(`/sales/${sale.id}?tab=${drawer.tab}&drawer=${drawer.name}${task.row ? `-${task.row}` : ""}`);

  const isBkp = sale.brand === "BAAN_KUNAPAP";
  const isExecutive = staff.role === "executive";
  const hasBkpWorkspace = isBkp && sale.can_finance;
  const hasStageBar = sale.can_finance && !!finance && !!agreement;
  const tabs: readonly CaseTab[] = sale.can_finance ? isBkp ? bkpCaseTabs : ["overview", "documents", "money"] : ["overview"];
  const requestedTab = one(query.tab);
  // The workspace opens on the tab of the stage in progress; a task page highlights the stage it belongs to.
  const stageTab = progress ? stageTabs[sale.brand][progress.complete ? 4 : progress.current] : "overview";
  const tab = resolveCaseTab(hasBkpWorkspace ? [...tabs, "documents"] : tabs, requestedTab ?? (sale.can_finance ? stageTab : undefined), one(query.flow));
  const data = { sale, finance, agreement, refunds, closeout, tasks, work, summary };
  const houseBrief = <HouseBriefPanel sale={sale} task={task} tab={tab} />;
  const isDesignBillingTask = !!task && ["issue-design-invoice", "prepare-design-payment", "cancel-design-invoice"].includes(task.name);
  let contractTemplate: { contract_text: string; contract_text_approved?: boolean; contractor_name?: string; contractor_address?: string; is_synthetic?: boolean } | undefined;
  const isContractTask = !!task && ["prepare-contract", "edit-contract", "lock-contract"].includes(task.name);
  // The header notice and the contract tab's blockers only need the template while a draft can still be locked; a failed read there just hides them.
  const hasContractDraft = !task && tab === "contract" && !!agreement?.documents.some(doc => doc.kind === "contract" && doc.state === "draft");
  if (isContractTask || (hasBkpWorkspace && (sale.status === "draft" || hasContractDraft))) {
    const template = await supabase.rpc("sales_contract_template", { p_case_id: sale.id });
    if (template.error && isContractTask) throw new Error("โหลดแม่แบบสัญญาไม่ได้ กรุณาลองใหม่");
    const parsed = z.object({ contract_text: z.string(), contract_text_approved: z.boolean().optional(),
      contractor_name: z.string().optional(), contractor_address: z.string().optional(), is_synthetic: z.boolean().optional() }).safeParse(template.data);
    if (parsed.success) contractTemplate = parsed.data;
    else if (isContractTask) throw new Error("โหลดแม่แบบสัญญาไม่ได้ กรุณาลองใหม่");
  }
  const missingPrerequisite = hasBkpWorkspace && sale.status === "draft" ? missingContractPrerequisite(contractTemplate) : null;
  const isFocusedTask = !!task && usesFocusedTaskHeader(task.name, isBkp);
  const isShowingNextStep = task && step?.task === task.name && step.row === task.row;
  const navigation = hasStageBar ? <>
    <StageBar caseId={sale.id} brand={sale.brand} current={progress ? progress.complete ? 5 : progress.current : -1} selected={task ? taskReturnTab(task.name, isBkp) : tab}
      designNote={designFeeNote(finance, agreement)} />
    {plotStatus(sale.status, reservation)}
    <StageNextStep caseId={sale.id} step={isShowingNextStep ? null : step} isExecutive={isExecutive} />
  </> : null;
  return <AppShell staff={staff} wide><div className="grid gap-6">
    {!isFocusedTask && <CaseHeader sale={sale} summary={!isBkp ? summary : null} showProgress={!isBkp} navigation={navigation} />}
    {missingPrerequisite && !isFocusedTask && <FixNotice {...guidance(missingPrerequisite, { brand: sale.brand, isExecutive })} />}
    {!isDesignBillingTask && !isFocusedTask && task?.name !== "accept-quotation" && (task || (!isBkp && tab !== "overview")) && houseBrief}
    {one(query.notice) === "task" && <p className={noticeClass} role="status">งานที่เปิดไม่ได้แล้ว เพราะสถานะหรือสิทธิ์เปลี่ยน กรุณาเลือกจากหน้านี้ใหม่</p>}
    {task ? <TaskView task={task} context={task.name === "design" ? houseBrief : undefined}
      data={{ sale, finance, agreement, staffId: staff.id, isExecutive, reservation, refunds, owners, contractTemplate, work }} /> : <>
      {tab === "overview" && <>
        {hasBkpWorkspace && <BkpOverview data={data} />}
        <OverviewSection data={data} houseBrief={houseBrief} />
      </>}
      {tab === "design" && finance && agreement && <DesignBillingPanel sale={sale} finance={finance} agreement={agreement} tasks={tasks} />}
      {(tab === "quotation" || tab === "contract") && <BkpAgreementSection data={data} tab={tab} contractTemplate={contractTemplate} isExecutive={isExecutive} />}
      {tab === "documents" && <DocumentsSection data={data} />}
      {tab === "money" && (isBkp ? <BkpMoneySection data={data} staffId={staff.id} /> : <MoneySection data={data} />)}
    </>}
    {isExecutive && isBkp && !task && <CancelProjectSection supabase={supabase} sale={sale} />}
  </div></AppShell>;
}
