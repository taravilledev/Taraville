import { ActionForm } from "@/app/walkin/action-form";
import { Drawer } from "@/components/drawer";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { panelClass } from "@/components/panel";
import { cn } from "@/lib/utils";
import { saveIssuer } from "../../money-actions";
import type { Brand, Issuer } from "./issuer-data";
import { PreservedFlags } from "./preserved-fields";

const rows = [["ชื่อนิติบุคคล / ผู้ออกเอกสาร", "legal_name"], ["เลขประจำตัวผู้เสียภาษี", "tax_id"], ["ที่อยู่", "address"], ["ข้อมูลติดต่อ", "contact"]] as const;

/** Company facts plus a drawer to edit them. The drawer re-posts the contract text and approval untouched. */
export function CompanyCard({ brand, brandName, issuer, requestId }: { brand: Brand; brandName: string; issuer?: Issuer; requestId: string }) {
  const action = saveIssuer.bind(null, { brand, version: issuer?.version ?? 0, requestId });
  return <section className={cn(panelClass, "grid min-w-0 gap-4")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="!m-0">ข้อมูลบริษัท · {brandName}</h2>
      {/* key: a saved version remounts the drawer closed, since the redirect keeps the same URL. */}
      <Drawer key={issuer?.version ?? 0} name="issuer-company" title="แก้ไขข้อมูลบริษัท"
        trigger={<button type="button" className={buttonVariants({ variant: "outline", size: "auto" })}>แก้ไขข้อมูลบริษัท</button>}>
        <ActionForm action={action} label="บันทึกข้อมูลบริษัท">
          <div className="grid gap-4">
            <Field><FieldLabel htmlFor="issuer-legal_name">ชื่อนิติบุคคล / ผู้ออกเอกสาร</FieldLabel><Input id="issuer-legal_name" name="legal_name" maxLength={300} required defaultValue={issuer?.legal_name} /></Field>
            <Field><FieldLabel htmlFor="issuer-tax_id">เลขประจำตัวผู้เสียภาษี</FieldLabel><Input id="issuer-tax_id" name="tax_id" maxLength={40} defaultValue={issuer?.tax_id} /></Field>
            <Field><FieldLabel htmlFor="issuer-address">ที่อยู่</FieldLabel><Textarea id="issuer-address" className="min-h-[100px]" name="address" required maxLength={3000} defaultValue={issuer?.address} /></Field>
            <Field><FieldLabel htmlFor="issuer-contact">ข้อมูลติดต่อ</FieldLabel><Input id="issuer-contact" name="contact" maxLength={500} defaultValue={issuer?.contact} /></Field>
            <textarea hidden readOnly name="contract_text" defaultValue={issuer?.contract_text ?? ""} />
            <PreservedFlags issuer={issuer} keepApproval={brand === "BAAN_KUNAPAP"} />
          </div>
        </ActionForm>
      </Drawer>
    </div>
    <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 max-[640px]:grid-cols-1 [&_dd]:m-0 [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-sm [&_dt]:text-muted-foreground">
      {rows.map(([label, key]) => <div key={key} className={key === "address" ? "col-span-full" : undefined}>
        <dt>{label}</dt><dd className="whitespace-pre-line">{issuer?.[key] || "—"}</dd>
      </div>)}
    </dl>
  </section>;
}
