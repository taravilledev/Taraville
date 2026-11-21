import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { salesBootstrap } from "@/lib/sales/queries";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { SettingsShell, type SettingsPageProps } from "../settings-shell";
import { catalogPage, matchesQuery, unitStatus } from "./catalog-list";
import { ProjectTable, UnitTable, statusLabels } from "./catalog-tables";
import { DevelopmentForm } from "./development-form";
import { UnitForm } from "./unit-form";
import { cn } from "@/lib/utils";
import * as ui from "../settings-styles";
import { panelClass } from "@/components/panel";
import { Drawer } from "@/components/drawer";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const base = "/sales/settings/catalog";

export const metadata = { title: "โครงการและบ้าน/แปลง · Taraville Group", robots: { index: false, follow: false } };
export default function CatalogPage(props: SettingsPageProps) {
  return <Suspense fallback={<PageSkeleton />}><Catalog {...props} /></Suspense>;
}

async function Catalog({ searchParams }: SettingsPageProps) {
  const { staff, workspace } = await salesBootstrap();
  const params = await searchParams;
  const development = workspace.developments.find(item => item.id === params.project);
  const get = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const q = get("q").trim().slice(0, 200);
  const project = development ? base + "?project=" + development.id : base;
  function listHref(page: number) {
    const query = new URLSearchParams(development ? { project: development.id } : {});
    if (q) query.set("q", q);
    if (get("status")) query.set("status", get("status"));
    if (page > 1) query.set("page", String(page));
    return query.size ? base + "?" + query.toString() : base;
  }
  const canEdit = workspace.can_catalog;
  const statuses = development ? statusLabels : { active: "เปิดใช้งาน", inactive: "ปิดใช้งาน" };
  const rawStatus = get("status");
  const status = Object.hasOwn(statuses, rawStatus) ? rawStatus : "";
  const developments = workspace.developments.filter(item => matchesQuery(q, [item.name, item.address])
    && (!status || status === (item.is_active ? "active" : "inactive")));
  const units = development?.units.filter(item => matchesQuery(q, [item.code, item.details.model, item.details.layout])
    && (!status || status === unitStatus(development.is_active, item)));
  const unitPage = catalogPage(units ?? [], get("page"));
  const developmentPage = catalogPage(developments, get("page"));
  const page = development ? unitPage : developmentPage;
  const primary = buttonVariants({ size: "auto" });
  const outline = buttonVariants({ variant: "outline", size: "auto" });

  return <SettingsShell staff={staff} workspace={workspace} section="catalog"
    title={development?.name ?? "ตั้งค่า"}
    description={development ? [development.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน", development.address].filter(Boolean).join(" · ")
      : "ข้อมูลกลางที่ใช้ในงานขายของทั้งสองแบรนด์"}
    back={development ? { href: base, label: "โครงการหมู่บ้าน" } : undefined}
    actions={canEdit && (development ? <>
      <Drawer name="edit-project" title="แก้ไขโครงการหมู่บ้าน" trigger={<button type="button" className={outline}>แก้ไขโครงการ</button>}>
        <DevelopmentForm development={development} />
      </Drawer>
      {development.is_active && <Drawer name="new-unit" title="เพิ่มบ้าน/แปลง" trigger={<button type="button" className={primary}>เพิ่มบ้าน/แปลง</button>}>
        <UnitForm developmentId={development.id} requestId={randomUUID()} />
      </Drawer>}
    </> : <Drawer name="new-project" title="เพิ่มโครงการหมู่บ้าน" trigger={<button type="button" className={primary}>เพิ่มโครงการ</button>}>
      <DevelopmentForm />
    </Drawer>)}>
    {!canEdit && <p role="note" className={ui.noteClass}><strong>ดูได้อย่างเดียว</strong> · ขอสิทธิ์ “จัดการโครงการหมู่บ้านและบ้าน/แปลง” จากผู้บริหารเพื่อเพิ่มหรือแก้ไข</p>}
    {canEdit && development && !development.is_active && <p role="note" className={ui.noteClass}>
      <strong>โครงการนี้ปิดใช้งานอยู่</strong> · เปิดใช้งานโครงการก่อนจึงเพิ่มบ้าน/แปลงหรือเปลี่ยนสถานะรายแปลงได้ (กด “แก้ไขโครงการ”)</p>}
    <form className={cn(panelClass, ui.filtersClass)} action={base} role="search">
      {development && <input type="hidden" name="project" value={development.id} />}
      <Field><FieldLabel htmlFor="catalog-q">{development ? "ค้นหาบ้าน/แปลง" : "ค้นหาโครงการ"}</FieldLabel><Input id="catalog-q" type="search" name="q" maxLength={200} defaultValue={q} placeholder={development ? "เลขแปลงหรือแบบบ้าน" : "ชื่อโครงการหรือที่ตั้ง"} /></Field>
      <Field><FieldLabel htmlFor="catalog-status">สถานะ</FieldLabel><NativeSelect id="catalog-status" name="status" defaultValue={status}>
        <option value="">ทุกสถานะ</option>
        {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </NativeSelect></Field>
      <button className={primary}>ค้นหา</button>
      {(q || status) && <Link href={project} className={outline} prefetch={false}>ล้างตัวกรอง</Link>}
    </form>
    {!page.rows.length ? <p className={panelClass}>{q || status ? "ไม่พบรายการตามตัวกรอง" : development ? "โครงการนี้ยังไม่มีบ้าน/แปลง" : "ยังไม่มีโครงการที่คุณดูได้"}</p>
      : development ? <UnitTable development={development} units={unitPage.rows}
        canEdit={canEdit} filter={{ q, status, page: page.page }} />
        : <ProjectTable developments={developmentPage.rows} base={base} />}
    <footer className={ui.footerClass}>
      <p className="text-sm text-muted-foreground">{development ? units?.length : developments.length} รายการ{page.pages > 1 && ` · หน้า ${page.page} จาก ${page.pages}`}</p>
      {page.pages > 1 && <nav className="flex flex-wrap items-center gap-3" aria-label="หน้ารายการ">
        {page.page > 1 && <Link className={outline} href={listHref(page.page - 1)} prefetch={false}>ก่อนหน้า</Link>}
        {page.page < page.pages && <Link className={outline} href={listHref(page.page + 1)} prefetch={false}>ถัดไป</Link>}
      </nav>}
    </footer>
  </SettingsShell>;
}
