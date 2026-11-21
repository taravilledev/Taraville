import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { salesBootstrap } from "@/lib/sales/queries";
import { brandLabels, brandSchema } from "@/lib/sales/models";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { SettingsLinks, SettingsShell, type SettingsPageProps } from "../settings-shell";
import { CompanyCard } from "./company-card";
import { ContractSection } from "./contract-section";
import { loadIssuer } from "./issuer-data";

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
  const issuer = await loadIssuer(supabase, brand);
  return <SettingsShell {...shell} title={brandLabels[brand]} description="ข้อมูลผู้ออกเอกสารสำหรับเอกสารที่ออกใหม่"
    back={{ href: base, label: "บริษัทผู้ออกเอกสาร" }}>
    <div className="grid min-w-0 max-w-[900px] gap-6">
      <CompanyCard brand={brand} brandName={brandLabels[brand]} issuer={issuer} requestId={randomUUID()} />
      <ContractSection brand={brand} brandName={brandLabels[brand]} issuer={issuer} editHref={`${base}/contract?brand=${brand}`} />
    </div>
  </SettingsShell>;
}
