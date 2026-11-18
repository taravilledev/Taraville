import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { salesBootstrap } from "@/lib/sales/queries";
import { formatMoney } from "@/lib/sales/money";
import type { SalesBootstrap } from "@/lib/sales/models";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { ActionForm } from "@/app/walkin/action-form";
import { saveDevelopment } from "../../actions";
import { SettingsShell, type SettingsPageProps } from "../settings-shell";
import { catalogPage, matchesQuery, unitStatus } from "./catalog-list";
import { setUnitActivity } from "./unit-activity";
import { UnitForm } from "./unit-form";
import sales from "../../sales.module.css";
import { checkRowClass } from "@/components/check-row";
import styles from "../settings.module.css";
import { panelClass } from "@/components/panel";
import { buttonVariants } from "@/components/ui/button";

const base = "/sales/settings/catalog";
const statusLabels = { available: "ว่าง", reserved: "กันไว้แล้ว", inactive: "ปิดใช้งาน" };
type Development = SalesBootstrap["developments"][number];

export const metadata = { title: "โครงการและบ้าน/แปลง · Taraville Group", robots: { index: false, follow: false } };
export default function CatalogPage(props: SettingsPageProps) {
  return <Suspense fallback={<PageSkeleton />}><Catalog {...props} /></Suspense>;
}

async function Catalog({ searchParams }: SettingsPageProps) {
  const { staff, workspace } = await salesBootstrap();
  const params = await searchParams;
  const development = workspace.developments.find(item => item.id === params.project);
  const unit = development?.units.find(item => item.id === params.unit);
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
  const backHref = listHref(Number(get("page")) || 1);
  const editHref = (mode: string, unitId?: string) => backHref
    + (backHref.includes("?") ? "&" : "?") + "edit=" + mode + (unitId ? "&unit=" + unitId : "");
  const shell = { staff, workspace, section: "catalog" as const };
  const canEdit = workspace.can_catalog;
  const mode = get("edit");
  if (canEdit && (mode === "new-project" && !params.project || mode === "project" && development)) {
    const title = development ? "แก้ไขโครงการหมู่บ้าน" : "เพิ่มโครงการหมู่บ้าน";
    return <SettingsShell {...shell} title={title} description={development?.name}
      back={{ href: backHref, label: development ? "ทะเบียนบ้านและแปลง" : "โครงการหมู่บ้าน" }}>
      <section className={`${panelClass} ${styles.editor}`}>
        <DevelopmentForm development={development} backHref={backHref} />
      </section>
    </SettingsShell>;
  }
  if (canEdit && development && (mode === "unit" && unit || mode === "new-unit" && development.is_active)) {
    return <SettingsShell {...shell} title={mode === "unit" && unit ? "แก้ไขบ้าน/แปลง " + unit.code : "เพิ่มบ้าน/แปลง"}
      description={development.name} back={{ href: backHref, label: "ทะเบียนบ้านและแปลง" }}>
      <section className={`${panelClass} ${styles.editor}`}>
        <UnitForm developmentId={development.id} unit={mode === "unit" ? unit : undefined}
          requestId={randomUUID()} backHref={backHref} />
      </section>
    </SettingsShell>;
  }

  const statuses = development ? statusLabels : { active: "เปิดใช้งาน", inactive: "ปิดใช้งาน" };
  const rawStatus = get("status");
  const status = Object.hasOwn(statuses, rawStatus) ? rawStatus : "";
  const developments = workspace.developments.filter(item => matchesQuery(q, [item.name, item.address])
    && (!status || status === (item.is_active ? "active" : "inactive")));
  const units = development?.units.filter(item => matchesQuery(q, [item.code, item.details.model, item.details.layout])
    && (!status || status === unitStatus(development.is_active, item)));
  const developmentPage = catalogPage(developments, get("page"));
  const unitPage = catalogPage(units ?? [], get("page"));
  const page = development ? unitPage : developmentPage;

  return <SettingsShell {...shell}
    title={development?.name ?? "โครงการและบ้าน/แปลง"}
    description={development ? [development.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน", development.address].filter(Boolean).join(" · ")
      : "เลือกโครงการธาราวิลล์เพื่อดูบ้าน แปลง และราคาทะเบียน"}
    back={development ? { href: base, label: "โครงการหมู่บ้าน" } : undefined}
    actions={canEdit && (development ? <>
      <Link href={editHref("project")} className={buttonVariants({ variant: "outline", size: "auto" })} prefetch={false}>แก้ไขโครงการ</Link>
      {development.is_active && <Link href={editHref("new-unit")} className={buttonVariants({ size: "auto" })} prefetch={false}>เพิ่มบ้าน/แปลง</Link>}
    </> : <Link href={editHref("new-project")} className={buttonVariants({ size: "auto" })} prefetch={false}>เพิ่มโครงการ</Link>)}>
    <form className={`${panelClass} ${styles.filters}`} action={base} role="search">
      {development && <input type="hidden" name="project" value={development.id} />}
      <label className={sales.field}>{development ? "ค้นหาบ้าน/แปลง" : "ค้นหาโครงการ"}
        <input type="search" name="q" maxLength={200} defaultValue={q} placeholder={development ? "เลขแปลงหรือแบบบ้าน" : "ชื่อโครงการหรือที่ตั้ง"} /></label>
      <label className={sales.field}>สถานะ<select name="status" defaultValue={status}>
        <option value="">ทุกสถานะ</option>
        {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className={buttonVariants({ size: "auto" })}>ค้นหา</button>
      {(q || status) && <Link href={project} className={buttonVariants({ variant: "outline", size: "auto" })} prefetch={false}>ล้างตัวกรอง</Link>}
    </form>
    {!page.rows.length ? <p className={panelClass}>{q || status ? "ไม่พบรายการตามตัวกรอง" : development ? "โครงการนี้ยังไม่มีบ้าน/แปลง" : "ยังไม่มีโครงการที่คุณดูได้"}</p>
      : <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={development ? "ทะเบียนบ้านและแปลง" : "รายการโครงการหมู่บ้าน"}>
        {development ? <table className={styles.table}>
          <thead><tr><th scope="col">บ้าน/แปลง</th><th scope="col">แบบบ้าน</th><th scope="col" className={styles.amount}>ราคาทะเบียน (บาท)</th><th scope="col">สถานะ</th>{canEdit && <th scope="col">ดำเนินการ</th>}</tr></thead>
          <tbody>{unitPage.rows.map(item => {
            const state = unitStatus(development.is_active, item);
            const detail = [item.details.layout, item.details.build_status].filter(value => typeof value === "string" && value).join(" · ");
            return <tr key={item.id}><th scope="row">{item.code}</th>
              <td>{typeof item.details.model === "string" && item.details.model || "—"}{detail && <small>{detail}</small>}</td>
              <td className={styles.amount}>{item.list_price_cents != null ? formatMoney(item.list_price_cents) : "—"}</td>
              <td className={styles.status}><span className={styles[state]}>{statusLabels[state]}</span></td>
              {canEdit && <td><div className={styles.rowActions} role="group" aria-label={`จัดการบ้าน/แปลง ${item.code}`}>
                <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={editHref("unit", item.id)} prefetch={false} aria-label={"แก้ไขบ้าน/แปลง " + item.code}>แก้ไข</Link>
                {development.is_active && <ActionForm inline action={setUnitActivity.bind(null, {
                  projectId: development.id, unitId: item.id, version: item.version, requestId: randomUUID(),
                  active: !item.is_active, q, status, page: page.page,
                })} label={item.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}>{null}</ActionForm>}
              </div></td>}
            </tr>;
          })}</tbody>
        </table> : <table className={styles.table}>
          <thead><tr><th scope="col">โครงการหมู่บ้าน</th><th scope="col">บ้าน/แปลง</th><th scope="col">สถานะ</th><th scope="col">ดำเนินการ</th></tr></thead>
          <tbody>{developmentPage.rows.map(item => <tr key={item.id}>
            <th scope="row">{item.name}{item.address && <small>{item.address}</small>}</th>
            <td>{item.units.length} แปลง</td><td className={styles.status}>{item.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</td>
            <td><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={base + "?project=" + item.id} prefetch={false} aria-label={"เปิดทะเบียน " + item.name}>เปิดทะเบียน</Link></td>
          </tr>)}</tbody>
        </table>}
      </div>}
    <footer className={styles.footer}>
      <p className="text-sm text-muted-foreground">{development ? units?.length : developments.length} รายการ{page.pages > 1 && ` · หน้า ${page.page} จาก ${page.pages}`}</p>
      {page.pages > 1 && <nav className="flex flex-wrap items-center gap-3" aria-label="หน้ารายการ">
        {page.page > 1 && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={listHref(page.page - 1)} prefetch={false}>ก่อนหน้า</Link>}
        {page.page < page.pages && <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={listHref(page.page + 1)} prefetch={false}>ถัดไป</Link>}
      </nav>}
    </footer>
  </SettingsShell>;
}

function DevelopmentForm({ development, backHref }: { development?: Development; backHref: string }) {
  return <ActionForm action={saveDevelopment.bind(null, { id: development?.id ?? null, version: development?.version ?? null, requestId: randomUUID() })}
    label={development ? "บันทึกโครงการ" : "เพิ่มโครงการ"} secondaryAction={{ href: backHref, label: "ยกเลิก" }}>
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      <label className={sales.field}>ชื่อโครงการ<input name="name" required maxLength={200} defaultValue={development?.name} /></label>
      <label className={`${sales.field} col-span-full`}>ที่ตั้งโครงการ<textarea name="address" maxLength={2000} defaultValue={development?.address} /></label>
    </div>
    <label className={checkRowClass}><input type="checkbox" name="is_active" defaultChecked={development?.is_active ?? true} />เปิดใช้งาน</label>
  </ActionForm>;
}
