import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { salesBootstrap } from "@/lib/sales/queries";
import { capabilityLabels, type Capability } from "@/lib/sales/models";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { ActionForm } from "@/app/walkin/action-form";
import { setCapability } from "../../actions";
import { SettingsLinks, SettingsShell, type SettingsPageProps } from "../settings-shell";
import sales from "../../sales.module.css";
import styles from "../settings.module.css";
import { panelClass } from "@/components/panel";

const base = "/sales/settings/permissions";
const groups = {
  "งานขายและทะเบียน": ["case", "catalog"],
  "สัญญาและตรวจรับ": ["contract", "acceptance"],
  "การเงินและเอกสารรับเงิน": ["financial", "billing", "receipt", "refund"],
};

export const metadata = { title: "จัดสิทธิ์งานและการเงิน · Taraville Group", robots: { index: false, follow: false } };
export default function PermissionsPage(props: SettingsPageProps) {
  return <Suspense fallback={<PageSkeleton />}><Permissions {...props} /></Suspense>;
}

async function Permissions({ searchParams }: SettingsPageProps) {
  const { staff, workspace } = await salesBootstrap();
  if (!workspace.can_admin) redirect("/dashboard");
  const raw = (await searchParams).staff;
  const people = workspace.staff.filter(user => user.is_active);
  const user = people.find(person => person.id === raw);
  const roleLabel = (role: string) => role === "executive" ? "ผู้บริหาร" : "พนักงาน";
  const shell = { staff, workspace, section: "permissions" as const };
  if (!user) return <SettingsShell {...shell} title="จัดสิทธิ์งานและการเงิน" description="เลือกพนักงานเพื่อดูหรือแก้ไขสิทธิ์">
    {people.length ? <SettingsLinks items={people.map(person => ({
      href: base + "?staff=" + person.id, title: person.full_name, description: roleLabel(person.role),
    }))} /> : <p className={panelClass}>ยังไม่มีพนักงานที่เปิดใช้งาน</p>}
  </SettingsShell>;

  return <SettingsShell {...shell} title={user.full_name} description={roleLabel(user.role)} back={{ href: base, label: "จัดสิทธิ์งานและการเงิน" }}>
    <aside className={styles.permissionHelp} aria-label="วิธีตั้งสิทธิ์">
      <p>เลือกการเข้าถึงและขอบเขต แล้วกด <strong>บันทึกสิทธิ์</strong> ในแถวที่แก้ไข</p>
      <p><strong>เฉพาะของตน</strong> ยึดผู้รับผิดชอบโครงการสำหรับการดู แก้ไข และตรวจรับงาน ส่วนการเปิดโครงการและสิทธิ์ด้านสัญญาหรือการเงินยึดเจ้าของ Lead ปัจจุบัน</p>
      <p>ผู้ขอคืนเงินอนุมัติคำขอของตนเองไม่ได้</p>
    </aside>
    {Object.entries(groups).map(([title, prefixes]) => <section key={title} className={`${panelClass} ${styles.group}`}>
      <h2>{title}</h2>
      {(Object.keys(capabilityLabels) as Capability[]).filter(action => prefixes.includes(action.split(".")[0])).map(action => {
        const override = user.capabilities.find(item => item.action === action);
        const ownDefault = ["case.view", "case.create", "case.edit", "financial.view"].includes(action);
        const enabled = override?.enabled ?? (user.role === "executive" || (ownDefault && (user.role === "sale" || action === "financial.view")));
        const scope = override?.scope ?? (user.role === "executive" ? "all" : "own");
        return <section key={action} className={styles.permissionRow} aria-labelledby={action}>
          <div className={styles.permissionTitle}>
            <h3 id={action}>{capabilityLabels[action]}</h3>
            <small className={styles.permissionSource} data-custom={Boolean(override)}>{override ? "ตั้งค่าเฉพาะคน" : "ค่าเริ่มต้นตามบทบาท"}</small>
          </div>
          <ActionForm action={setCapability} label="บันทึกสิทธิ์" inline>
            <input type="hidden" name="staff_id" value={user.id} /><input type="hidden" name="capability" value={action} /><input type="hidden" name="request_id" value={randomUUID()} />
            <div className={styles.permissionFields}>
              <label className={sales.field}>การเข้าถึง<select name="enabled" defaultValue={String(enabled)}><option value="true">อนุญาต</option><option value="false">ไม่อนุญาต</option></select></label>
              <label className={sales.field}>ขอบเขต<select name="scope" defaultValue={action === "catalog.manage" ? "all" : scope}>{action !== "catalog.manage" && <option value="own">เฉพาะของตน</option>}<option value="all">ทุกรายการ</option></select></label>
            </div>
          </ActionForm>
        </section>;
      })}
    </section>)}
  </SettingsShell>;
}
