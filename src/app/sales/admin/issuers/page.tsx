import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { salesBootstrap } from "@/lib/sales/queries";
import { issuerSchema } from "@/lib/sales/financial-models";
import { brandLabels } from "@/lib/sales/models";
import { ActionForm } from "@/app/walkin/action-form";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { saveIssuer } from "../../money-actions";
import styles from "../../sales.module.css";

export const metadata = { title: "บริษัทผู้ออกเอกสาร · Taraville Group", robots: { index: false, follow: false } };
export default function IssuersPage() { return <Suspense fallback={<PageSkeleton />}><Issuers /></Suspense>; }
async function Issuers() {
  const { staff, workspace, supabase } = await salesBootstrap();
  if (!workspace.can_admin) redirect("/sales");
  const result = await supabase.rpc("sales_issuer_settings");
  if (result.error) throw new Error("โหลดข้อมูลผู้ออกเอกสารไม่ได้ กรุณาลองใหม่");
  const issuers = issuerSchema.array().parse(result.data);
  return <AppShell staff={staff} wide><div className={styles.page}>
    <div className={styles.header}><h1>บริษัทผู้ออกเอกสาร</h1><Link href="/sales/admin" prefetch={false}>กลับจัดสิทธิ์</Link></div>
    <p className={styles.muted}>ข้อมูลนี้จะถูกสำเนาไว้ในเอกสารที่ออกใหม่ การแก้ไขไม่เปลี่ยนเอกสารเดิม</p>
    {(["BAAN_KUNAPAP", "TARAVILLE"] as const).map(brand => {
      const issuer = issuers.find(item => item.brand === brand);
      return <section key={brand} className={styles.panel}><h2>{brandLabels[brand]}</h2>
        <ActionForm action={saveIssuer.bind(null, { brand, version: issuer?.version ?? 0, requestId: randomUUID() })} label="บันทึกบริษัทผู้ออกเอกสาร"><div className={styles.grid}>
          <label className={styles.field}>ชื่อนิติบุคคล / ผู้ออกเอกสาร<input name="legal_name" maxLength={300} required defaultValue={issuer?.legal_name} /></label>
          <label className={styles.field}>เลขประจำตัวผู้เสียภาษี<input name="tax_id" maxLength={40} defaultValue={issuer?.tax_id} /></label>
          <label className={`${styles.field} ${styles.full}`}>ที่อยู่<textarea name="address" required maxLength={3000} defaultValue={issuer?.address} /></label>
          <label className={styles.field}>ข้อมูลติดต่อ<input name="contact" maxLength={500} defaultValue={issuer?.contact} /></label>
          <label className={styles.check}><input type="checkbox" name="is_synthetic" defaultChecked={issuer?.is_synthetic ?? true} />ข้อมูลทดสอบ (แสดงข้อความบนเอกสาร)</label>
          <label className={`${styles.field} ${styles.full}`}>ข้อความสัญญาที่บริษัทอนุมัติ<textarea name="contract_text" maxLength={100000} defaultValue={issuer?.contract_text} /><small className={styles.muted}>เว้นว่างได้ระหว่างเตรียมระบบ ต้องมีฉบับที่บริษัทอนุมัติก่อนออกสัญญาจริง</small></label>
        </div></ActionForm>
      </section>;
    })}
  </div></AppShell>;
}
