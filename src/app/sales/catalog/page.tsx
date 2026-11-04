import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { salesBootstrap } from "@/lib/sales/queries";
import { formatMoney } from "@/lib/sales/money";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { ActionForm } from "@/app/walkin/action-form";
import { saveDevelopment } from "../actions";
import { UnitForm } from "./unit-form";
import styles from "../sales.module.css";

export const metadata = { title: "โครงการและบ้าน/แปลง · Taraville Group", robots: { index: false, follow: false } };
export default function CatalogPage() { return <Suspense fallback={<PageSkeleton />}><Catalog /></Suspense>; }
async function Catalog() {
  const { staff, workspace } = await salesBootstrap();
  return <AppShell staff={staff} wide><div className={styles.page}>
    <div className={styles.header}><div><h1>โครงการและบ้าน/แปลง</h1><p>ธาราวิลล์ · ข้อมูลทะเบียนบ้านพร้อมที่ดิน</p></div><Link className={styles.link} href="/sales" prefetch={false}>กลับรายการงาน</Link></div>
    {workspace.can_catalog && <details className={styles.panel}><summary>เพิ่มโครงการหมู่บ้าน</summary><ActionForm action={saveDevelopment.bind(null, { id: null, version: null, requestId: randomUUID() })} label="เพิ่มโครงการ">
      <div className={styles.grid}><label className={styles.field}>ชื่อโครงการ<input name="name" required maxLength={200} /></label>
        <label className={styles.field}>ที่ตั้งโครงการ<textarea name="address" maxLength={2000} /></label></div>
      <label className={styles.check}><input type="checkbox" name="is_active" defaultChecked />เปิดใช้งาน</label>
    </ActionForm></details>}
    {!workspace.developments.length && <p className={styles.panel}>ยังไม่มีโครงการที่คุณดูได้</p>}
    {workspace.developments.map(development => <section key={development.id} className={styles.panel}>
      <div className={styles.header}><div><h2>{development.name}</h2><p className={styles.muted}>{development.address || "—"}</p></div><span className={styles.tag}>{development.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span></div>
      {workspace.can_catalog && <details><summary>แก้ไขโครงการหมู่บ้าน</summary><ActionForm action={saveDevelopment.bind(null, { id: development.id, version: development.version, requestId: randomUUID() })} label="บันทึกโครงการ">
        <div className={styles.grid}><label className={styles.field}>ชื่อโครงการ<input name="name" required maxLength={200} defaultValue={development.name} /></label>
          <label className={styles.field}>ที่ตั้งโครงการ<textarea name="address" maxLength={2000} defaultValue={development.address} /></label></div>
        <label className={styles.check}><input type="checkbox" name="is_active" defaultChecked={development.is_active} />เปิดใช้งาน</label>
      </ActionForm></details>}
      <ul className={styles.list}>{development.units.map(unit => <li className={styles.case} key={unit.id}>
        <div><strong>{unit.code}</strong><p className={styles.muted}>{typeof unit.details.model === "string" ? unit.details.model : "—"} · ราคาทะเบียน {unit.list_price_cents != null ? `${formatMoney(unit.list_price_cents)} บาท` : "—"}</p>
          {workspace.can_catalog && <details><summary>แก้ไขบ้าน/แปลง {unit.code}</summary><UnitForm developmentId={development.id} unit={unit} requestId={randomUUID()} /></details>}</div>
        <span className={styles.tag}>{!development.is_active || !unit.is_active ? "ปิดใช้งาน" : unit.is_available ? "ว่าง" : "กันไว้แล้ว"}</span>
      </li>)}</ul>
      {workspace.can_catalog && development.is_active && <details><summary>เพิ่มบ้าน/แปลงใน {development.name}</summary><UnitForm developmentId={development.id} requestId={randomUUID()} /></details>}
    </section>)}
  </div></AppShell>;
}
