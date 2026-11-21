import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { salesBootstrap } from "@/lib/sales/queries";
import { brandLabels, brandSchema } from "@/lib/sales/models";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { saveIssuer } from "../../../money-actions";
import { SettingsShell, type SettingsPageProps } from "../../settings-shell";
import { contractStatus } from "../contract-section";
import { loadIssuer } from "../issuer-data";
import { ContractEditorForm } from "./contract-editor-form";

const base = "/sales/settings/issuers";

export const metadata = { title: "ข้อความสัญญา · Taraville Group", robots: { index: false, follow: false } };
export default function ContractEditorPage(props: SettingsPageProps) {
  return <Suspense fallback={<PageSkeleton />}><ContractEditor {...props} /></Suspense>;
}

async function ContractEditor({ searchParams }: SettingsPageProps) {
  const { staff, workspace, supabase } = await salesBootstrap();
  if (!workspace.can_admin) redirect("/dashboard");
  const brand = brandSchema.safeParse((await searchParams).brand).data;
  if (!brand) redirect(base);
  const issuer = await loadIssuer(supabase, brand);
  const name = brandLabels[brand];
  const needsApproval = brand === "BAAN_KUNAPAP";
  return <SettingsShell staff={staff} workspace={workspace} section="issuers" title={`แก้ข้อความสัญญามาตรฐาน · ${name}`}
    description={contractStatus(brand, issuer).label} back={{ href: `${base}?brand=${brand}`, label: `บริษัทผู้ออกเอกสาร · ${name}` }}>
    <ContractEditorForm action={saveIssuer.bind(null, { brand, version: issuer?.version ?? 0, requestId: randomUUID() })}
      brandName={name} needsApproval={needsApproval} cancelHref={`${base}?brand=${brand}`}
      isApproved={Boolean(issuer?.contract_text_approved)} issuer={issuer ? {
        legal_name: issuer.legal_name, address: issuer.address, tax_id: issuer.tax_id, contact: issuer.contact,
        contract_text: issuer.contract_text, is_synthetic: issuer.is_synthetic } : undefined} />
  </SettingsShell>;
}
