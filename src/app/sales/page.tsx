import { Suspense } from "react";
import Link from "next/link";
import { salesBootstrap, salesCaseList } from "@/lib/sales/queries";
import { brandLabels, caseStatusLabels } from "@/lib/sales/models";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import styles from "./sales.module.css";

export const metadata = { title: "งานและรายการขาย · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const statusOptions = { active: "กำลังดำเนินการ", all: "ทั้งหมด", ...caseStatusLabels };
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

export default function SalesPage(props: Props) { return <Suspense fallback={<PageSkeleton />}><Workspace {...props} /></Suspense>; }
async function Workspace({ searchParams }: Props) {
  const raw = await searchParams;
  const status = Object.hasOwn(statusOptions, one(raw.status)) ? one(raw.status) : "active";
  const brand = Object.hasOwn(brandLabels, one(raw.brand)) ? one(raw.brand) : "";
  const query = one(raw.q).trim().slice(0, 100);
  const [{ staff, workspace }, cases] = await Promise.all([salesBootstrap(), salesCaseList({ status, brand, query })]);
  const filtered = status !== "active" || brand !== "" || query !== "";
  return <AppShell staff={staff} wide><div className={styles.page}>
    <div className={styles.header}><div><h1>งานและรายการขาย</h1><p>บ้านคุณภาพ · ธาราวิลล์</p></div>
      <div className={styles.links}>
        {workspace.leads.length > 0 && <Link className={styles.primary} href="/sales/new" prefetch={false}>เปิดงาน/รายการขาย</Link>}
        {(workspace.can_catalog || workspace.developments.length > 0) && <Link className={styles.link} href="/sales/catalog" prefetch={false}>โครงการและบ้าน/แปลง</Link>}
        {workspace.can_admin && <Link className={styles.link} href="/sales/admin" prefetch={false}>จัดสิทธิ์</Link>}
      </div>
    </div>
    <form className={styles.filters} method="get" role="search">
      <label className={styles.field}>ค้นหาชื่อลูกค้าหรือรหัส<input type="search" name="q" defaultValue={query} maxLength={100} /></label>
      <label className={styles.field}>แบรนด์<select name="brand" defaultValue={brand}><option value="">ทั้งสองแบรนด์</option>
        {Object.entries(brandLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={styles.field}>สถานะ<select name="status" defaultValue={status}>
        {Object.entries(statusOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button className={styles.primary} type="submit">ค้นหา</button>
      {filtered && <Link className={styles.link} href="/sales" prefetch={false}>ล้างตัวกรอง</Link>}
    </form>
    <p className={styles.muted}>ข้อมูลและเอกสารการเงินแสดงตามสิทธิ์ของคุณ การอ่าน Lead ร่วมกันไม่เพิ่มสิทธิ์การเงิน · พบ {cases.length}{cases.length === 100 ? "+" : ""} รายการ</p>
    {cases.length ? <ul className={styles.list}>{cases.map(sale => <li key={sale.id} className={styles.case}>
      <div><Link href={`/sales/${sale.id}`} prefetch={false}>{sale.code} · {sale.customer_name}</Link>
        <p className={styles.muted}>{brandLabels[sale.brand]}{sale.detail && sale.detail !== sale.code ? ` · ${sale.detail}` : ""} · {sale.can_finance ? "ดูข้อมูลการเงินได้" : "ดูข้อมูลงาน"}</p></div>
      <span className={styles.tag}>{caseStatusLabels[sale.status]}</span>
    </li>)}</ul> : filtered
      ? <section className={styles.panel}><h2>ไม่พบรายการตามตัวกรอง</h2><p>ลองเปลี่ยนคำค้นหรือเลือกสถานะทั้งหมด</p></section>
      : <section className={styles.panel}><h2>ยังไม่มีรายการที่คุณดูได้</h2><p>เริ่มเปิดงานจาก Lead หรือให้ผู้บริหารตรวจสอบสิทธิ์ของคุณ</p><Link href="/leads" prefetch={false}>ไปที่รายการ Lead</Link></section>}
    {cases.length === 100 && <p className={styles.muted}>แสดง 100 รายการล่าสุดที่ตรงกับตัวกรอง ใช้การค้นหาเพื่อจำกัดให้แคบลง</p>}
  </div></AppShell>;
}
