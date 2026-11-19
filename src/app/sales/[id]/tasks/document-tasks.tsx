import { useId } from "react";
import { ContractAddendumForm } from "./contract-addendum-form";
import { addContractAddendum } from "../../agreement-actions";
import { contractPaperMissing } from "@/lib/sales/contract-paper";
import { ActionForm } from "@/app/walkin/action-form";

import { acceptQuotation, issueQuotation, prepareContract, signContract, signPropertyContract, lockContract, unlockContract } from "../../agreement-actions";
import { saveBookingSummary } from "../../adjustment-actions";
import { saveDesign } from "../../money-actions";
import { EvidenceUpload } from "../../evidence-upload";
import { QuotationEditor } from "./quotation-editor";
import { ContractWizard } from "./contract-wizard";
import { AgreementContent } from "../../documents/[id]/agreement-content";
import Link from "next/link";
import { checkRowClass } from "@/components/check-row";
import { idOf, type TaskData } from "./task-data";
import { DesignPackages } from "./design-packages";
import { formatMoney } from "@/lib/sales/money";
import * as acceptance from "./quotation-acceptance-styles";
import { noticeClass } from "@/components/notice";
import { FixNotice } from "@/components/fix-notice";
import { guidance } from "@/lib/errors/error-map";
import { missingContractPrerequisite } from "@/lib/sales/contract-template";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export function DesignTask({ sale, finance }: TaskData) {
  const plan = finance?.design_plan;
  return <ActionForm action={saveDesign.bind(null, idOf(sale, sale.id, finance?.version))} label="บันทึกค่าออกแบบ">
    <DesignPackages initialArea={plan ? plan.usable_area ?? "" : sale.house_brief?.usable_area ?? String(sale.details?.usable_area ?? "")} plan={plan} />
  </ActionForm>;
}

export function IssueQuotationTask({ sale, agreement, finance }: TaskData) {
  return <QuotationEditor sale={sale} agreement={agreement} designArea={finance?.design_plan?.usable_area}
    action={issueQuotation.bind(null, idOf(sale))} />;
}

export function AcceptQuotationTask({ sale, agreement, row }: TaskData) {
  const document = agreement?.documents.find(doc => doc.id === row && doc.kind === "quotation");
  if (!document) return null;
  return <ActionForm action={acceptQuotation.bind(null, { ...idOf(sale, row), caseId: sale.id })} label="บันทึกลูกค้ายอมรับใบเสนอราคาฉบับนี้">
    <div className={acceptance.content}>
      <div className={acceptance.quote}><div><h3>{document.number ?? "ใบเสนอราคา"} · ฉบับที่ {document.revision}</h3>
        <p>{document.payload.paper?.customer_name ?? document.customer_snapshot?.full_name ?? sale.customer_name} · ยอดเสนอ {formatMoney(document.payload.total_cents ?? "0")} บาท</p></div>
        <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/documents/${document.id}`} prefetch={false} target="_blank" rel="noopener noreferrer">ดูใบเสนอราคาฉบับนี้ (แท็บใหม่)</Link></div>
      <div><p className={acceptance.help}>แนบภาพแชต LINE หรือเอกสารที่ยืนยันว่าลูกค้ายอมรับใบเสนอราคาฉบับนี้ ก่อนดำเนินการสัญญา</p>
        <EvidenceUpload caseId={sale.id} category="agreement" className={acceptance.evidence} /></div>
      <label className={acceptance.confirmation}><input type="checkbox" name="confirmed" required />ยืนยันว่าลูกค้ายอมรับใบเสนอราคาฉบับที่ {document.revision} ตามหลักฐานที่แนบแล้ว</label>
    </div>
  </ActionForm>;
}

export function PrepareContractTask({ sale, agreement, finance, row, contractTemplate }: TaskData) {
  if (!agreement) return null;
  const draft = agreement.documents.find(doc => doc.id === row && doc.state === "draft");
  const credit = finance?.payments.filter(payment => payment.kind === "design_fee")
    .reduce((sum, payment) => sum + BigInt(payment.totals.free_cents ?? "0"), BigInt(0)).toString() ?? "0";
  return <ContractWizard sale={sale} agreement={agreement} draftId={draft?.id} creditCents={credit} contractText={contractTemplate?.contract_text}
    contractTextApproved={contractTemplate?.contract_text_approved}
    contractDefaults={{ contractor_name: contractTemplate?.contractor_name ?? "", contractor_address: contractTemplate?.contractor_address ?? "" }}
    action={prepareContract.bind(null, { ...idOf(sale), documentId: draft?.id ?? null, documentVersion: draft?.version ?? null })} />;
}

export function LockContractTask({ sale, agreement, row, contractTemplate, isExecutive = false }: TaskData) {
  const draft = agreement?.documents.find(doc => doc.id === row && doc.state === "draft");
  if (!draft) return null;
  const paper = draft.payload.contract_paper;
  const missing = [...(paper ? contractPaperMissing(paper, !!contractTemplate?.is_synthetic) : []), ...(!draft.payload.start_date ? ["วันเริ่มก่อสร้าง"] : [])];
  const needsApproval = !contractTemplate?.is_synthetic && (!contractTemplate?.contract_text_approved || draft.payload.contract_text !== contractTemplate.contract_text);
  const prerequisite = missingContractPrerequisite(contractTemplate);
  const canLock = !needsApproval && (!!paper || contractTemplate?.is_synthetic) && !missing.length && !!draft.payload.contract_text?.trim();
  return <>
    <p>ตรวจข้อมูลก่อนออกเลขสัญญา ยอดเครดิตจะคำนวณจากเงินที่รับจริง ณ ตอนล็อก</p>
    <AgreementContent payload={draft.payload} />
    {prerequisite && <FixNotice {...guidance(prerequisite, { brand: sale.brand, isExecutive })} />}
    {!canLock && !prerequisite && <p className={noticeClass} role="status">{needsApproval
      ? "บันทึกร่างอีกครั้งเพื่อใช้ข้อความสัญญาที่อนุมัติล่าสุด"
      : missing.length ? `กรอกข้อมูลก่อนออกเลข: ${missing.join(" · ")}` : "กลับไปบันทึกร่างบนแม่แบบใหม่และตรวจข้อความบริษัทก่อนออกเลข"}</p>}
    {!canLock && <p><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}?task=edit-contract&row=${draft.id}`} prefetch={false}>กลับไปแก้ร่าง</Link></p>}
    {canLock && <ActionForm action={lockContract.bind(null, { ...idOf(sale), documentId: draft.id, documentVersion: draft.version })} label="ล็อกและออกเลขสัญญา"
      secondaryAction={{ label: "กลับไปแก้ร่าง", href: `/sales/${sale.id}?task=edit-contract&row=${draft.id}` }}>
      <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ตรวจข้อมูลและพร้อมพิมพ์ให้ลงนาม</label>
    </ActionForm>}
  </>;
}

export function UnlockContractTask({ sale, agreement, row }: TaskData) {
  const id = useId();
  const doc = agreement?.documents.find(item => item.id === row && item.state === "awaiting_signature");
  if (!doc) return null;
  return <ActionForm action={unlockContract.bind(null, { ...idOf(sale), documentId: doc.id, documentVersion: doc.version })} label="ปลดล็อกและสร้างร่างใหม่">
    <p>เลขที่ {doc.number} จะเก็บเป็นฉบับยกเลิก การล็อกร่างใหม่จะออกเลขใหม่</p>
    <Field><FieldLabel htmlFor={`${id}-reason`}>เหตุผลที่แก้ร่าง</FieldLabel><Textarea id={`${id}-reason`} name="reason" required maxLength={3000} /></Field>
    <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ฉบับนี้ยังไม่ได้ลงนาม และยืนยันกลับไปแก้ร่าง</label>
  </ActionForm>;
}

export function SignContractTask({ sale, agreement, row }: TaskData) {
  const document = agreement?.documents.find(doc => doc.id === row && doc.kind === "contract" && doc.state === "awaiting_signature");
  if (!document) return null;
  const scheduleCount = document.payload.schedule?.length ?? document.payload.schedule_input?.length;
  return <ActionForm action={signContract.bind(null, { ...idOf(sale, row), caseId: sale.id })} label="บันทึกลงนามสัญญาฉบับนี้">
    <div className={acceptance.content}>
      <div className={acceptance.quote}><div><h3>{document.number ?? "สัญญา"} · ฉบับที่ {document.revision}</h3>
        <p>{document.payload.customer?.full_name ?? document.customer_snapshot?.full_name ?? sale.customer_name}</p>
        <p>มูลค่าสัญญา {document.payload.total_cents == null ? "ยังไม่ระบุ" : `${formatMoney(document.payload.total_cents)} บาท`}
          {scheduleCount != null ? ` · ${scheduleCount} งวด` : ""} · รอลงนาม</p></div>
        <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/documents/${document.id}`} prefetch={false} target="_blank" rel="noopener noreferrer">เปิดสัญญาฉบับนี้ (แท็บใหม่)</Link>
      </div>
      <div><p className={acceptance.help}>เปิดตรวจเลขสัญญาและตารางงวดให้ตรงฉบับ แล้วแนบเอกสารที่ลงนามเรียบร้อยแล้ว</p>
        <EvidenceUpload caseId={sale.id} category="agreement" className={acceptance.evidence} title="สัญญาและตารางงวดที่ลงนามแล้ว" /></div>
      <label className={acceptance.confirmation}><input type="checkbox" name="confirmed" required />ตรวจสอบสัญญา {document.number ?? `ฉบับที่ ${document.revision}`} และตารางงวดที่ลงนามแล้ว ตรงกับหลักฐานที่อัปโหลด</label>
    </div>
  </ActionForm>;
}

export function BookingSummaryTask({ sale }: TaskData) {
  const id = useId();
  return <ActionForm action={saveBookingSummary.bind(null, idOf(sale))} label="บันทึกสรุปการจอง">
    <p>บันทึกเอกสารแต่ละฉบับจากข้อมูลการขายล่าสุด การบันทึกเอกสารไม่กันแปลง</p>
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      <Field><FieldLabel htmlFor={`${id}-booking`}>ยอดจอง (บาท)</FieldLabel><Input id={`${id}-booking`} name="booking" inputMode="decimal" /></Field>
      <Field><FieldLabel htmlFor={`${id}-contract`}>ยอดวันทำสัญญา (บาท)</FieldLabel><Input id={`${id}-contract`} name="contract" inputMode="decimal" /></Field>
      <Field><FieldLabel htmlFor={`${id}-down`}>ยอดดาวน์รวม (บาท)</FieldLabel><Input id={`${id}-down`} name="down" inputMode="decimal" /></Field>
      <Field><FieldLabel htmlFor={`${id}-mortgage`}>ยอดยื่นกู้ (บาท)</FieldLabel><Input id={`${id}-mortgage`} name="mortgage" inputMode="decimal" /></Field>
      <Field><FieldLabel htmlFor={`${id}-booking_date`}>วันนัดจอง</FieldLabel><Input id={`${id}-booking_date`} name="booking_date" type="date" /></Field>
      <Field><FieldLabel htmlFor={`${id}-contract_date`}>วันนัดทำสัญญา</FieldLabel><Input id={`${id}-contract_date`} name="contract_date" type="date" /></Field>
      <Field><FieldLabel htmlFor={`${id}-down_date`}>วันนัดดาวน์งวดแรก</FieldLabel><Input id={`${id}-down_date`} name="down_date" type="date" /></Field>
      <Field><FieldLabel htmlFor={`${id}-conditions`}>เงื่อนไข</FieldLabel><Textarea id={`${id}-conditions`} name="conditions" maxLength={5000} /></Field>
      <Field><FieldLabel htmlFor={`${id}-freebies`}>ของแถม</FieldLabel><Textarea id={`${id}-freebies`} name="freebies" maxLength={5000} /></Field>
    </div>
  </ActionForm>;
}

export function SignPropertyContractTask({ sale, finance }: TaskData) {
  const id = useId();
  const summaries = finance?.documents.filter(doc => doc.kind === "summary") ?? [];
  return <ActionForm action={signPropertyContract.bind(null, idOf(sale))} label="บันทึกสัญญาขาย">
    <Field><FieldLabel htmlFor={`${id}-summary_id`}>สรุปการจองที่ตกลง</FieldLabel><NativeSelect id={`${id}-summary_id`} name="summary_id" required defaultValue="">
      <option value="" disabled>เลือกเอกสาร</option>{summaries.map(doc => <option key={doc.id} value={doc.id}>{doc.number}</option>)}
    </NativeSelect></Field>
    <Field><FieldLabel htmlFor={`${id}-down_count`}>จำนวนงวดดาวน์ (0 หากไม่มี)</FieldLabel><Input id={`${id}-down_count`} name="down_count" type="number" min={0} max={98} step={1} required /></Field>
    <EvidenceUpload caseId={sale.id} category="agreement" />
    <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ตรวจสอบสัญญาที่ลงนามและยอดเงินจองแล้ว</label>
  </ActionForm>;
}

export function ContractAddendumTask({ sale, agreement, row }: TaskData) {
  const contract = agreement?.documents.find(doc => doc.id === row && doc.kind === "contract" && doc.state === "signed");
  return contract ? <ContractAddendumForm contract={contract} caseId={sale.id}
    action={addContractAddendum.bind(null, { ...idOf(sale, contract.id), caseId: sale.id })} /> : null;
}
