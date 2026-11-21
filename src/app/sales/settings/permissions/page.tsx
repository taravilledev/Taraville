import { Suspense } from "react";
import { redirect } from "next/navigation";
import { salesBootstrap } from "@/lib/sales/queries";
import { capabilityLabels, type Capability } from "@/lib/sales/models";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { SettingsShell, type SettingsPageProps } from "../settings-shell";
import { DataRow, DataTable, RowLink } from "@/components/data-table";
import { panelClass } from "@/components/panel";
import { formErrorClass } from "@/components/form-feedback";
import { defaultEnabled, defaultScope, parseCapabilityDefaults, type StaffRole } from "./capability-defaults";
import { PermissionMatrix, type MatrixGroup } from "./permission-matrix";

const base = "/sales/settings/permissions";
const groupPrefixes = {
  "งานขายและทะเบียน": ["case", "catalog"],
  "สัญญาและตรวจรับ": ["contract", "acceptance"],
  "การเงินและเอกสารรับเงิน": ["financial", "billing", "receipt", "refund"],
};
const roleLabels: Record<StaffRole, string> = { executive: "ผู้บริหาร", sale: "ฝ่ายขาย", staff: "พนักงาน" };

export const metadata = { title: "จัดสิทธิ์งานและการเงิน · Taraville Group", robots: { index: false, follow: false } };
export default function PermissionsPage(props: SettingsPageProps) {
  return <Suspense fallback={<PageSkeleton />}><Permissions {...props} /></Suspense>;
}

async function Permissions({ searchParams }: SettingsPageProps) {
  const { staff, workspace, supabase } = await salesBootstrap();
  if (!workspace.can_admin) redirect("/dashboard");
  const raw = (await searchParams).staff;
  const people = workspace.staff.filter(user => user.is_active);
  const user = people.find(person => person.id === raw);
  const shell = { staff, workspace, section: "permissions" as const };
  if (!user) return <SettingsShell {...shell} title="จัดสิทธิ์งานและการเงิน" description="เลือกพนักงานเพื่อดูหรือแก้ไขสิทธิ์">
    {people.length ? <DataTable label="พนักงานที่ใช้งานอยู่">
      <thead><tr><th scope="col">ชื่อ</th><th scope="col">บทบาท</th><th scope="col">สิทธิ์ที่ตั้งเฉพาะคน</th></tr></thead>
      <tbody>{people.map(person => <DataRow key={person.id}>
        <td><RowLink href={base + "?staff=" + person.id} className="font-semibold">{person.full_name}</RowLink></td>
        <td>{roleLabels[person.role]}</td>
        <td>{person.capabilities.length ? `${person.capabilities.length} รายการ` : "ไม่มี (ใช้ค่าเริ่มต้น)"}</td>
      </DataRow>)}</tbody>
    </DataTable> : <p className={panelClass}>ยังไม่มีพนักงานที่เปิดใช้งาน</p>}
  </SettingsShell>;

  const { data, error } = await supabase.rpc("sales_capability_defaults");
  const defaults = error ? null : parseCapabilityDefaults(data);
  const back = { href: base, label: "จัดสิทธิ์งานและการเงิน" };
  if (!defaults) return <SettingsShell {...shell} title={user.full_name} description={roleLabels[user.role]} back={back}>
    <p className={formErrorClass} role="alert">โหลดค่าเริ่มต้นของสิทธิ์ไม่ได้</p>
  </SettingsShell>;

  const groups: MatrixGroup[] = Object.entries(groupPrefixes).map(([title, prefixes]) => ({
    title,
    rows: (Object.keys(capabilityLabels) as Capability[]).filter(action => prefixes.includes(action.split(".")[0])).map(action => {
      const override = user.capabilities.find(item => item.action === action);
      const fallback = { enabled: defaultEnabled(user.role, action, defaults), scope: defaultScope(user.role, action) };
      const isScopeFixed = action === "catalog.manage";
      return { action, label: capabilityLabels[action], fallback, isOverride: Boolean(override), isScopeFixed,
        saved: override ? { enabled: override.enabled, scope: isScopeFixed ? "all" : override.scope } : fallback };
    }),
  }));
  return <SettingsShell {...shell} title={user.full_name} description={roleLabels[user.role]} back={back}>
    <aside className="rounded-lg border bg-card p-4 text-sm text-muted-foreground" aria-label="วิธีตั้งสิทธิ์">
      <p className="m-0">ค่าเริ่มต้นมาจากบทบาท ปรับเฉพาะคนได้ <strong>เฉพาะของตน</strong> ยึดผู้รับผิดชอบโครงการสำหรับการดู แก้ไข และตรวจรับงาน ส่วนการเปิดโครงการและสิทธิ์ด้านสัญญาหรือการเงินยึดเจ้าของ Lead ปัจจุบัน ผู้ขอคืนเงินอนุมัติคำขอของตนเองไม่ได้</p>
    </aside>
    <PermissionMatrix staffId={user.id} staffName={user.full_name} groups={groups} />
  </SettingsShell>;
}
