import Link from "next/link";
import { ActionForm } from "@/app/walkin/action-form";
import type { SalesBootstrap } from "@/lib/sales/models";
import { createCase } from "../actions";
import styles from "../sales.module.css";
import { OpeningFields } from "./opening-fields";
import { noticeClass } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";

type Lead = SalesBootstrap["leads"][number];

export function NewCaseForm({ workspace, lead, projects, projectId, requestId }: {
  workspace: SalesBootstrap; lead: Lead; projects: { id: string; code: string }[]; projectId: string; requestId: string;
}) {
  const units = workspace.developments.filter(development => development.is_active)
    .map(development => ({ ...development, units: development.units.filter(unit => unit.is_active && unit.is_available) }))
    .filter(development => development.units.length > 0);
  if (lead.brand === "TARAVILLE" && !units.length) return <div className={noticeClass}>
    <h2>ยังไม่มีบ้าน/แปลงว่างให้เปิดโครงการ</h2>
    <p>ต้องมีบ้าน/แปลงว่างก่อน จึงจะเปิดร่างโครงการได้</p>
    {workspace.can_catalog ? <Link className={buttonVariants({ variant: "outline", size: "auto" })} href="/sales/settings/catalog" prefetch={false}>จัดการหมู่บ้านและบ้าน/แปลง</Link>
      : <p>ติดต่อผู้มีสิทธิ์จัดการหมู่บ้านและบ้าน/แปลงเพื่อเพิ่มหรือปล่อยแปลง</p>}
  </div>;
  if (lead.brand === "TARAVILLE") return <OpeningFields leadId={lead.id} requestId={requestId}
    units={units.flatMap(development => development.units.map(unit => ({
      id: unit.id, developmentId: development.id, code: unit.code, location: development.name, address: development.address,
      details: unit.details, price: unit.list_price_cents,
    })))} />;
  return <ActionForm action={createCase} label="เปิดโครงการ">
    <input type="hidden" name="request_id" value={requestId} />
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      <input type="hidden" name="lead_id" value={lead.id} />
      <label className={`${styles.field} col-span-full`}>โครงการ<select name="project_id" required defaultValue={projectId}>
        <option value="" disabled>เลือกโครงการ</option>{projects.map(project => <option key={project.id} value={project.id}>{project.code}</option>)}
      </select></label>
      <input type="hidden" name="customer_id" value="" />
    </div>
    <p className={styles.muted}>เปิดเป็นร่างสำหรับโครงการที่เลือก สามารถกรอกข้อมูลต่อได้หลังเปิดโครงการ</p>
  </ActionForm>;
}
