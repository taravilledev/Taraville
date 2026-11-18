import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { salesBootstrap } from "@/lib/sales/queries";
import { issuerSchema } from "@/lib/sales/financial-models";
import { brandLabels, brandSchema } from "@/lib/sales/models";
import { ActionForm } from "@/app/walkin/action-form";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { saveIssuer } from "../../money-actions";
import { SettingsLinks, SettingsShell, type SettingsPageProps } from "../settings-shell";
import styles from "../../sales.module.css";
import settings from "../settings.module.css";

const base = "/sales/settings/issuers";

export const metadata = { title: "บริษัทผู้ออกเอกสาร · Taraville Group", robots: { index: false, follow: false } };
export default function IssuersPage(props: SettingsPageProps) {
  return <Suspense fallback={<PageSkeleton />}><Issuers {...props} /></Suspense>;
}

async function Issuers({ searchParams }: SettingsPageProps) {
  const { staff, workspace, supabase } = await salesBootstrap();
  if (!workspace.can_admin) redirect("/dashboard");
  const brand = brandSchema.safeParse((await searchParams).brand).data;
  const shell = { staff, workspace, section: "issuers" as const };
  if (!brand) return <SettingsShell {...shell} title="บริษัทผู้ออกเอกสาร" description="เลือกแบรนด์ที่ต้องการตั้งค่า">
    <SettingsLinks items={brandSchema.options.map(value => ({
      title: brandLabels[value], href: base + "?brand=" + value, description: "ข้อมูลนิติบุคคลและข้อความสัญญา",
    }))} />
  </SettingsShell>;
  const result = await supabase.rpc("sales_issuer_settings");
  if (result.error) throw new Error("โหลดข้อมูลผู้ออกเอกสารไม่ได้ กรุณาลองใหม่");
  const issuer = issuerSchema.array().parse(result.data).find(item => item.brand === brand);
  return <SettingsShell {...shell} title={brandLabels[brand]} description="ข้อมูลผู้ออกเอกสารสำหรับเอกสารที่ออกใหม่"
    back={{ href: base, label: "บริษัทผู้ออกเอกสาร" }}>
    <section className={`${styles.panel} ${settings.editor}`}>
      <ActionForm action={saveIssuer.bind(null, { brand, version: issuer?.version ?? 0, requestId: randomUUID() })} label="บันทึกบริษัทผู้ออกเอกสาร" secondaryAction={{ label: "ยกเลิก", href: base }}><div className={styles.grid}>
          <label className={styles.field}>ชื่อนิติบุคคล / ผู้ออกเอกสาร<input name="legal_name" maxLength={300} required defaultValue={issuer?.legal_name} /></label>
          <label className={styles.field}>เลขประจำตัวผู้เสียภาษี<input name="tax_id" maxLength={40} defaultValue={issuer?.tax_id} /></label>
          <label className={`${styles.field} ${styles.full}`}>ที่อยู่<textarea name="address" required maxLength={3000} defaultValue={issuer?.address} /></label>
          <label className={styles.field}>ข้อมูลติดต่อ<input name="contact" maxLength={500} defaultValue={issuer?.contact} /></label>
          <label className={styles.check}><input type="checkbox" name="is_synthetic" defaultChecked={issuer?.is_synthetic ?? true} />ข้อมูลทดสอบ (แสดงข้อความบนเอกสาร)</label>
          <label className={`${styles.field} ${styles.full}`}>ข้อความสัญญามาตรฐาน<textarea name="contract_text" maxLength={100000} defaultValue={issuer?.contract_text} /><small className={styles.muted}>เว้นว่างได้ระหว่างเตรียมระบบ ต้องมีฉบับที่บริษัทอนุมัติก่อนออกสัญญาจริง</small></label>
          {brand === "BAAN_KUNAPAP" && <label className={styles.check}><input type="checkbox" name="contract_text_approved" />ยืนยันว่าบริษัทอนุมัติข้อความฉบับที่บันทึกนี้ให้ใช้กับธุรกรรมจริง{issuer?.contract_text_approved ? " · ข้อความที่บันทึกอยู่ได้รับอนุมัติแล้ว" : ""}</label>}
        </div></ActionForm>
    </section>
  </SettingsShell>;
}
