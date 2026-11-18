import Link from "next/link";
import type { FinancialDetail } from "@/lib/sales/financial-models";
import type { SalesCase } from "@/lib/sales/models";
import { designPackages } from "@/lib/sales/design-fees";
import { formatMoney } from "@/lib/sales/money";
import { findTask, taskHref, type Task } from "@/lib/sales/tasks";
import { WorkspaceHeading } from "./workspace-heading";
import workspace from "./workspace-section.module.css";
import { buttonVariants } from "@/components/ui/button";

export function DesignBillingPanel({ sale, finance, tasks }: { sale: SalesCase; finance: FinancialDetail; tasks: Task[] }) {
  if (sale.brand !== "BAAN_KUNAPAP") return null;
  const plan = finance.design_plan;
  const canEdit = finance.can_change_design && !!findTask(tasks, "design", undefined);
  const packageName = plan ? designPackages.find(item => item.id === plan.tier)?.range ?? "แพ็กเกจเฉพาะโครงการ" : "ยังไม่ได้เลือกแพ็กเกจ";
  const pendingCount = finance.pending.filter(payment => payment.kind === "design_fee").length;
  return <section className={workspace.section} id="design-fees" aria-labelledby="design-billing-title">
    <WorkspaceHeading caseId={sale.id} title="ออกแบบ" titleId="design-billing-title" description="แพ็กเกจค่าออกแบบและพื้นที่ใช้สอยจริงของโครงการ" />
    <div className={workspace.card}><div className={workspace.rowHeading}><h3>{packageName}</h3>
      <span className={workspace.status}>{plan ? "กำหนดค่าออกแบบแล้ว" : "รอกำหนดค่าออกแบบ"}</span></div>
      {plan ? <dl className={workspace.facts}>
        <div><dt>พื้นที่ใช้สอยจริง</dt><dd>{plan.usable_area ? `${plan.usable_area} ตร.ม.` : "ยังไม่ระบุ"}</dd></div>
        <div><dt>ค่าออกแบบรวม</dt><dd className={workspace.amount}>{formatMoney(plan.total_cents)} บาท</dd></div>
        <div><dt>งวดค่าออกแบบ</dt><dd>{plan.instalments.length} งวด</dd></div>
      </dl> : <p>เลือกแพ็กเกจและกรอกพื้นที่ใช้สอยจริงก่อนเริ่มเรียกเก็บค่าออกแบบ</p>}
      <div className={workspace.actions}>{canEdit && <Link className={plan ? buttonVariants({ variant: "outline", size: "auto" }) : buttonVariants({ size: "auto" })} href={taskHref(sale.id, "design")} prefetch={false}>{plan ? "แก้แพ็กเกจและพื้นที่" : "เลือกแพ็กเกจค่าออกแบบ"}</Link>}</div>
      {!canEdit && <p className={workspace.note}>{plan ? "แก้แพ็กเกจไม่ได้ตามสถานะปัจจุบัน ตรวจบิลและประวัติเงินที่หน้าการเงิน" : "รอผู้มีสิทธิ์กำหนดค่าออกแบบ"}</p>}
      {plan?.note && <p className={workspace.note}>{plan.note}</p>}
      <div className={workspace.next} id="pending"><p>ออกบิล รับเงิน และดูใบเสร็จค่าออกแบบได้ที่หน้าการเงิน{pendingCount ? ` · มีเงินค่าแบบรอยืนยัน ${pendingCount} รายการ` : ""}</p>
        <div className={workspace.actions}><Link className={plan ? buttonVariants({ size: "auto" }) : buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}?tab=money#${pendingCount ? "pending" : "design-fees"}`} prefetch={false}>ไปการเงิน{pendingCount ? " · ตรวจเงินรอยืนยัน" : " · ค่าออกแบบ"}</Link></div>
      </div>
    </div>
  </section>;
}
