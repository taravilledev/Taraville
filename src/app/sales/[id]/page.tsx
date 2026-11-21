import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { salesCase } from "@/lib/sales/queries";
import { loadCaseData } from "@/lib/sales/case-loader";
import { bkpCaseTabs, resolveCaseTab } from "@/lib/sales/case-navigation";
import { type CaseTab } from "@/lib/sales/case-progress";
import { availableTasks, findTask } from "@/lib/sales/tasks";
import { taskContext } from "@/lib/sales/task-context";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { CaseHeader } from "./case-header";
import { BkpOverview, BkpAgreementSection } from "./bkp-workflow";
import { BkpProgress } from "./bkp-progress";
import { HouseBriefPanel } from "./house-brief-panel";
import { DesignBillingPanel } from "./design-billing-panel";
import { DocumentsSection, MoneySection, OverviewSection } from "./summary-sections";
import { TaskView } from "./tasks/task-view";
import { usesFocusedTaskHeader } from "./tasks/task-header";
import { tabLinksClass } from "@/components/tab-links";
import { noticeClass } from "@/components/notice";
import { FixNotice } from "@/components/fix-notice";
import { CancelProjectSection } from "@/app/walkin/cancel-project-section";
import { guidance } from "@/lib/errors/error-map";
import { missingContractPrerequisite } from "@/lib/sales/contract-template";
import { cn } from "@/lib/utils";

export const metadata = { title: "ข้อมูลงานและรายการขาย · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const tabLabels: Record<CaseTab, string> = { overview: "ภาพรวม", design: "ออกแบบ", quotation: "ใบเสนอราคา", contract: "สัญญา", documents: "เอกสารทั้งหมด", money: "การเงิน" };
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export default function CasePage(props: Props) { return <Suspense fallback={<PageSkeleton />}><CaseDetail {...props} /></Suspense>; }
async function CaseDetail({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const { staff, sale, supabase } = await salesCase(id);
  const { work, finance, agreement, closeout, reservation, refunds, pending, summary, step, progress } = await loadCaseData(supabase, sale);
  const assignments = sale.can_assign ? await supabase.from("staff").select("id,full_name").eq("is_active", true).order("full_name") : { data: [], error: null };
  if (assignments.error) throw new Error("โหลดผู้รับผิดชอบไม่ได้ กรุณาลองใหม่");
  const owners = z.object({ id: z.uuid(), full_name: z.string() }).array().parse(assignments.data);
  const tasks = availableTasks(taskContext({ sale, finance, agreement, refunds, staffId: staff.id, reservation, work }));
  const name = one(query.task);
  const task = name ? findTask(tasks, name, one(query.row)) : undefined;
  // A stale or no-longer-allowed task link returns to the summary with the reason.
  if (name && !task) redirect(`/sales/${sale.id}?notice=task`);

  const isBkp = sale.brand === "BAAN_KUNAPAP";
  const isExecutive = staff.role === "executive";
  const hasBkpWorkspace = isBkp && sale.can_finance;
  const tabs: readonly CaseTab[] = sale.can_finance ? isBkp ? bkpCaseTabs : ["overview", "documents", "money"] : ["overview"];
  const tab = resolveCaseTab(hasBkpWorkspace ? [...tabs, "documents"] : tabs, one(query.tab), one(query.flow));
  const data = { sale, finance, agreement, refunds, closeout, tasks, work, summary };
  const houseBrief = <HouseBriefPanel sale={sale} task={task} tab={tab} />;
  const isDesignBillingTask = !!task && ["issue-design-invoice", "prepare-design-payment", "cancel-design-invoice"].includes(task.name);
  let contractTemplate: { contract_text: string; contract_text_approved?: boolean; contractor_name?: string; contractor_address?: string; is_synthetic?: boolean } | undefined;
  const isContractTask = !!task && ["prepare-contract", "edit-contract", "lock-contract"].includes(task.name);
  // The header notice only needs the template while a BKP case can still be drafted; a failed read there just hides the notice.
  if (isContractTask || (hasBkpWorkspace && sale.status === "draft")) {
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
  const navigation = !task && tabs.length > 1 ? <nav className={cn(tabLinksClass, isBkp && "grid grid-cols-5 gap-0 max-[680px]:grid-cols-3 [&_a]:min-w-0 [&_a]:justify-center [&_a]:px-2 [&_a]:text-center")} aria-label="หมวดข้อมูลงาน">{tabs.map(item => <Link key={item} href={`/sales/${sale.id}?tab=${item}`} prefetch={false}
    aria-current={item === tab ? "page" : undefined}>{!isBkp && item === "documents" ? "เอกสาร" : !isBkp && item === "money" ? "รับเงิน" : tabLabels[item]}{item === "money" && pending > 0 ? ` (${pending})` : ""}</Link>)}</nav> : null;
  return <AppShell staff={staff} wide><div className="grid gap-6">
    {!isFocusedTask && <CaseHeader isExecutive={isExecutive} sale={sale} summary={!isBkp ? summary : null} step={isShowingNextStep ? null : step}
      showProgress={!isBkp || !!task}
      navigation={isBkp ? navigation : undefined}
      workflow={sale.brand === "BAAN_KUNAPAP" && finance && agreement && progress ?
        <BkpProgress isExecutive={isExecutive} sale={sale} finance={finance} agreement={agreement} progress={progress} step={step} tasks={tasks} activeTask={task} compact={(!task && tab === "documents") || isFocusedTask || isDesignBillingTask} /> : undefined} />}
    {missingPrerequisite && !isFocusedTask && <FixNotice {...guidance(missingPrerequisite, { brand: sale.brand, isExecutive })} />}
    {!isDesignBillingTask && !isFocusedTask && task?.name !== "accept-quotation" && (task || (!isBkp && tab !== "overview")) && houseBrief}
    {one(query.notice) === "task" && <p className={noticeClass} role="status">งานที่เปิดไม่ได้แล้ว เพราะสถานะหรือสิทธิ์เปลี่ยน กรุณาเลือกจากหน้านี้ใหม่</p>}
    {task ? <TaskView task={task} context={task.name === "design" ? houseBrief : undefined}
      data={{ sale, finance, agreement, staffId: staff.id, isExecutive, reservation, refunds, owners, contractTemplate, work }} /> : <>
      {!isBkp && navigation}
      {tab === "overview" && <>
        {hasBkpWorkspace && <BkpOverview data={data} step={step} isExecutive={isExecutive} />}
        <OverviewSection data={data} houseBrief={houseBrief} />
      </>}
      {tab === "design" && finance && <DesignBillingPanel sale={sale} finance={finance} tasks={tasks} />}
      {(tab === "quotation" || tab === "contract") && <BkpAgreementSection data={data} tab={tab} />}
      {tab === "documents" && <DocumentsSection data={data} />}
      {tab === "money" && <MoneySection data={data} />}
    </>}
    {isExecutive && isBkp && !task && <CancelProjectSection supabase={supabase} sale={sale} />}
  </div></AppShell>;
}
