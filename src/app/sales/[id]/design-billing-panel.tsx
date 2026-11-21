import Link from "next/link";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { SalesCase } from "@/lib/sales/models";
import { designPackages } from "@/lib/sales/design-fees";
import { formatMoney } from "@/lib/sales/money";
import { findTask, type Task } from "@/lib/sales/tasks";
import { DesignTask } from "./tasks/document-tasks";
import { DesignInstalmentCards } from "./design-instalment-cards";
import { WorkspaceHeading } from "./workspace-heading";
import * as ws from "./workspace-styles";
import { Drawer } from "@/components/drawer";
import { Status } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";

/** The ออกแบบ tab body: package card (package form in a drawer) and the three design-fee instalments. */
export function DesignBillingPanel({ sale, finance, agreement, tasks }: { sale: SalesCase; finance: FinancialDetail; agreement: AgreementDetail; tasks: Task[] }) {
  if (sale.brand !== "BAAN_KUNAPAP") return null;
  const plan = finance.design_plan;
  const canEdit = finance.can_change_design && !!findTask(tasks, "design", undefined);
  const packageName = plan ? designPackages.find(item => item.id === plan.tier)?.range ?? "แพ็กเกจเฉพาะโครงการ" : "ยังไม่ได้เลือกแพ็กเกจ";
  const pendingCount = finance.pending.filter(payment => payment.kind === "design_fee").length;
  const drawerTitle = plan ? "เปลี่ยนแพ็กเกจ" : "กำหนดค่าออกแบบ";
  return <section className={ws.section} id="design-fees" aria-labelledby="design-billing-title">
    <WorkspaceHeading caseId={sale.id} title="ออกแบบ" titleId="design-billing-title" description="แพ็กเกจค่าออกแบบและพื้นที่ใช้สอยจริงของโครงการ" />
    <div className={ws.card}><div className={ws.rowHeading}><h3>{packageName}</h3>
      <Status tone={plan ? "success" : "waiting"}>{plan ? "กำหนดค่าออกแบบแล้ว" : "รอกำหนดค่าออกแบบ"}</Status></div>
      {plan ? <dl className={ws.facts}>
        <div><dt>พื้นที่ใช้สอยจริง</dt><dd>{plan.usable_area ? `${plan.usable_area} ตร.ม.` : "ยังไม่ระบุ"}</dd></div>
        <div><dt>ค่าออกแบบรวม</dt><dd className={ws.amount}>{formatMoney(plan.total_cents)} บาท</dd></div>
        <div><dt>งวดค่าออกแบบ</dt><dd>{plan.instalments.length} งวด</dd></div>
      </dl> : <p>เลือกแพ็กเกจและกรอกพื้นที่ใช้สอยจริงก่อนเริ่มเรียกเก็บค่าออกแบบ</p>}
      {canEdit && <div className={ws.actions}>
        <Drawer name="design" title={drawerTitle} trigger={<button type="button" className={buttonVariants({ variant: plan ? "outline" : "default", size: "auto" })}>{drawerTitle}</button>}>
          <DesignTask sale={sale} finance={finance} key={`${sale.version}:${finance.version}`} />
        </Drawer>
      </div>}
      {!canEdit && <p className={ws.note}>{plan ? "แก้แพ็กเกจไม่ได้ตามสถานะปัจจุบัน ตรวจบิลและประวัติเงินที่หน้าการเงิน" : "รอผู้มีสิทธิ์กำหนดค่าออกแบบ"}</p>}
      {plan?.note && <p className={ws.note}>{plan.note}</p>}
    </div>
    {plan && <DesignInstalmentCards caseId={sale.id} finance={finance} agreement={agreement} tasks={tasks} />}
    <div className={ws.next} id="pending"><p>ดูใบเสร็จ ประวัติบิล และรายการรับเงินทั้งหมดได้ที่หน้าการเงิน{pendingCount ? ` · มีเงินค่าแบบรอยืนยัน ${pendingCount} รายการ` : ""}</p>
      <div className={ws.actions}><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}?tab=money#${pendingCount ? "pending" : "design-fees"}`} prefetch={false}>ไปการเงิน{pendingCount ? " · ตรวจเงินรอยืนยัน" : " · ค่าออกแบบ"}</Link></div>
    </div>
  </section>;
}
