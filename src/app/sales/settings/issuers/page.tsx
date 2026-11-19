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
import { checkRowClass } from "@/components/check-row";
import { cn } from "@/lib/utils";
import { editorClass } from "../settings-styles";
import { panelClass } from "@/components/panel";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    <section className={cn(panelClass, editorClass)}>
      <ActionForm action={saveIssuer.bind(null, { brand, version: issuer?.version ?? 0, requestId: randomUUID() })} label="บันทึกบริษัทผู้ออกเอกสาร" secondaryAction={{ label: "ยกเลิก", href: base }}><div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Field><FieldLabel htmlFor="issuer-legal_name">ชื่อนิติบุคคล / ผู้ออกเอกสาร</FieldLabel><Input id="issuer-legal_name" name="legal_name" maxLength={300} required defaultValue={issuer?.legal_name} /></Field>
          <Field><FieldLabel htmlFor="issuer-tax_id">เลขประจำตัวผู้เสียภาษี</FieldLabel><Input id="issuer-tax_id" name="tax_id" maxLength={40} defaultValue={issuer?.tax_id} /></Field>
          <Field className="col-span-full"><FieldLabel htmlFor="issuer-address">ที่อยู่</FieldLabel><Textarea id="issuer-address" className="min-h-[100px]" name="address" required maxLength={3000} defaultValue={issuer?.address} /></Field>
          <Field><FieldLabel htmlFor="issuer-contact">ข้อมูลติดต่อ</FieldLabel><Input id="issuer-contact" name="contact" maxLength={500} defaultValue={issuer?.contact} /></Field>
          <label className={checkRowClass}><input type="checkbox" name="is_synthetic" defaultChecked={issuer?.is_synthetic ?? true} />ข้อมูลทดสอบ (แสดงข้อความบนเอกสาร)</label>
          <Field className="col-span-full"><FieldLabel htmlFor="issuer-contract_text">ข้อความสัญญามาตรฐาน</FieldLabel><Textarea id="issuer-contract_text" aria-describedby="issuer-contract_text-hint" name="contract_text" maxLength={100000} defaultValue={issuer?.contract_text} /><FieldDescription id="issuer-contract_text-hint">เว้นว่างได้ระหว่างเตรียมระบบ ต้องมีฉบับที่บริษัทอนุมัติก่อนออกสัญญาจริง</FieldDescription></Field>
          {brand === "BAAN_KUNAPAP" && <label className={checkRowClass}><input type="checkbox" name="contract_text_approved" />ยืนยันว่าบริษัทอนุมัติข้อความฉบับที่บันทึกนี้ให้ใช้กับธุรกรรมจริง{issuer?.contract_text_approved ? " · ข้อความที่บันทึกอยู่ได้รับอนุมัติแล้ว" : ""}</label>}
        </div></ActionForm>
    </section>
  </SettingsShell>;
}
