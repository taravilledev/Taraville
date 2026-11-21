import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { documentSchema, savedDocumentSchema, paymentKinds, paymentMethods } from "@/lib/sales/financial-models";
import { agreementPayloadSchema } from "@/lib/sales/agreement-models";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import styles from "./document.module.css";
import { AgreementContent } from "./agreement-content";
import { PhotoContractContent } from "./photo-contract-content";
import { QuotationContent } from "./quotation-content";
import { QuotationPages } from "./quotation-pages";
import { ReceiptPaper } from "./receipt-paper";
import { backTarget, DocumentBar, DocumentStatusBar } from "./document-chrome";
import Image from "next/image";

export const metadata = { title: "เอกสารการขาย · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export default function DocumentPage(props: Props) { return <Suspense fallback={<PageSkeleton />}><Document {...props} /></Suspense>; }
async function Document({ params, searchParams }: Props) {
  const isPreview = (await searchParams).preview === "1";
  const { id } = await params; const { supabase } = await requireStaff();
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await supabase.rpc("sales_document_detail", { p_document_id: id });
  if (result.error?.code === "42501") notFound();
  if (result.error) throw new Error("โหลดเอกสารไม่ได้ กรุณาลองใหม่");
  const doc = savedDocumentSchema.parse(result.data); const issuer = doc.issuer_snapshot;
  const receipt = doc.kind === "receipt" ? documentSchema.parse(result.data).payload : null;
  if (!["receipt", "quotation", "contract", "invoice", "refund", "amendment", "closeout", "summary"].includes(doc.kind)) notFound();
  const isSynthetic = z.boolean().parse(doc.payload.is_synthetic);
  const isTextAddendum = doc.kind === "amendment" && !!doc.payload.text_addendum;
  const agreement = (isTextAddendum || ["quotation", "contract"].includes(doc.kind)) ? agreementPayloadSchema.parse(doc.payload) : null;
  const isQuotation = doc.kind === "quotation" && issuer.brand === "BAAN_KUNAPAP";
  const isPaperContract = isTextAddendum || doc.kind === "contract" && issuer.brand === "BAAN_KUNAPAP" && !!agreement?.customer && !!agreement?.schedule;
  const quotePaper = isQuotation ? agreement?.paper : undefined;
  const invoice = doc.kind === "invoice" ? z.object({ label: z.string(), gross_cents: z.string().regex(/^\d+$/), credit_cents: z.string().regex(/^\d+$/),
    net_cents: z.string().regex(/^\d+$/), due_date: z.string(), credit_settled: z.boolean(),
    acceptance_date: z.iso.date().nullish(), payment_due_days: z.literal(30).nullish() }).parse(doc.payload) : null;
  const refund = doc.kind === "refund" ? z.object({ amount_cents: z.string().regex(/^\d+$/), reason: z.string(),
    method: z.enum(["cash", "transfer", "cheque"]), paid_date: z.string() }).parse(doc.payload) : null;
  const adjustment = !isTextAddendum && ["amendment", "closeout"].includes(doc.kind) ? z.object({
    reason: z.string(), agreement_text: z.string(), total_cents: z.string().optional(),
    contract_number: z.string().optional(), development: z.string().optional(), plot: z.string().optional(),
    retained_cents: z.string().optional(), received_cents: z.string().optional(),
    remaining_cents: z.string().optional(), refund_due_cents: z.string().optional(),
  }).parse(doc.payload) : null;
  const summary = doc.kind === "summary" ? z.object({
    development: z.string(), plot: z.string(), total_cents: z.string(), booking_cents: z.string().nullish(),
    contract_cents: z.string().nullish(), down_cents: z.string().nullish(), balance_cents: z.string(), conditions: z.string(), freebies: z.string(),
    details: z.record(z.string(), z.unknown()).default({}),
    list_cents: z.string().nullish(), promotion_cents: z.string().nullish(), discount_cents: z.string().nullish(),
    mortgage_cents: z.string().nullish(), booking_date: z.string().nullish(), contract_date: z.string().nullish(), down_date: z.string().nullish(),
  }).parse(doc.payload) : null;
  const title = isTextAddendum ? "บันทึกข้อตกลงแนบท้ายสัญญา" : summary ? "สรุปการจอง" : doc.kind === "amendment" ? "ข้อตกลงแก้ไขสัญญา" : doc.kind === "closeout" ? "ข้อตกลงปิดงาน"
    : receipt ? "ใบเสร็จรับเงิน" : refund ? "เอกสารจ่ายคืนเงิน" : doc.kind === "quotation" ? "ใบเสนอราคา" : doc.kind === "contract" ? (issuer.brand === "TARAVILLE" ? "สัญญาขาย" : "สัญญาก่อสร้าง") : invoice?.credit_settled ? "สรุปชำระด้วยเครดิตเดิม" : "ใบแจ้งชำระ";
  const invoiceAdjustments = invoice && doc.adjustments.length > 0 ? <section className={styles.invoiceAdjustments}>
    <h3>การปรับยอดตามข้อตกลงภายหลัง</h3>
    <ul>{doc.adjustments.map(item => <li key={item.document_id}>
      <Link href={`/sales/documents/${item.document_id}`} prefetch={false}>{item.number}</Link>
      {" · "}{item.amount_cents.startsWith("-") ? "ลดยอด " : "เพิ่มยอด "}{formatMoney(item.amount_cents.replace(/^-/, ""))} บาท
    </li>)}</ul>
    <p>ยอดสุทธิหลังปรับ {formatMoney(doc.adjustments.reduce((total, item) => total + BigInt(item.amount_cents), BigInt(invoice.net_cents)).toString())} บาท</p>
  </section> : null;
  const bar = isPreview ? null : <DocumentBar back={backTarget({ caseId: doc.case_id, kind: doc.kind, isBkp: issuer.brand === "BAAN_KUNAPAP",
    isDesignInvoice: typeof doc.payload.design_position === "number", isTextAddendum })} />;
  const statusBar = <DocumentStatusBar isSynthetic={isSynthetic} state={doc.state} cancelReason={doc.cancel_reason} />;
  if (receipt && issuer.brand === "BAAN_KUNAPAP") return <main className={styles.page}>
    {bar}
    {statusBar}
    <ReceiptPaper issuer={issuer} customer={doc.customer_snapshot} number={doc.number} date={doc.document_date}
      paidDate={receipt.paid_date} method={receipt.method} payerName={receipt.payer_name} receiverName={receipt.confirmed_by_name}
      amountCents={receipt.amount_cents} label={paymentKinds[receipt.kind]} description={receipt.description}
      isInstalment={receipt.kind === "instalment" || receipt.kind === "design_fee"}
     
      replacement={receipt.replaces_number ? `ออกแทนใบเสร็จเลขที่ ${receipt.replaces_number}${receipt.replacement_reason ? ` · ${receipt.replacement_reason}` : ""}` : undefined} />
  </main>;
  if (invoice && issuer.brand === "BAAN_KUNAPAP") return <main className={styles.page}>
    {bar}
    {statusBar}
    <ReceiptPaper issuer={issuer} customer={doc.customer_snapshot} number={doc.number} date={doc.document_date}
      amountCents={invoice.net_cents} label={invoice.label} isInstalment
      invoice={{ dueDate: invoice.due_date, grossCents: invoice.gross_cents, creditCents: invoice.credit_cents,
        acceptanceDate: invoice.payment_due_days === 30 ? invoice.acceptance_date ?? undefined : undefined, isCreditSettled: invoice.credit_settled }}>
      {invoiceAdjustments}
    </ReceiptPaper>
  </main>;
  if (quotePaper && agreement) return <main className={styles.page}>
    {bar}
    {statusBar}
    <QuotationPages payload={agreement} date={doc.document_date} number={doc.number} issuerName={issuer.legal_name} />
  </main>;
  if (isPaperContract && agreement?.contract_paper && !isTextAddendum) return <main className={styles.page}>
    {bar}
    {statusBar}
    <PhotoContractContent payload={agreement} number={doc.number} />
  </main>;
  return <main className={styles.page}>
    {bar}
    {statusBar}
    <article className={`${styles.paper}${summary ? ` ${styles.summary}` : ""}${isQuotation ? ` ${styles.quotation}` : ""}${isPaperContract ? ` ${styles.contractDocument}` : ""}`}>
      {isQuotation && <Image className={styles.quoteLogo} src="/brand/baan-kunapap-logo.jpg" alt="บ้านคุณภาพ" width={100} height={76} />}
      <div className={styles.header}><div><h1>{issuer.legal_name}</h1><p>{issuer.address}</p>{issuer.tax_id && <p>เลขประจำตัวผู้เสียภาษี {issuer.tax_id}</p>}<p>{issuer.contact}</p></div>
        <div><h2>{title}</h2><p>เลขที่ {doc.number ?? "ยังไม่ออกเลข"}</p><p>วันที่ {doc.document_date}</p></div></div>
      <section className={styles.customer}><p><strong>ลูกค้า</strong> {quotePaper?.customer_name ?? doc.customer_snapshot.full_name}</p><p><strong>{isQuotation ? "ที่อยู่ลูกค้า" : "ที่อยู่"}</strong> {(quotePaper?.customer_address ?? doc.customer_snapshot.address) || "—"}</p>
        <p><strong>โทรศัพท์</strong> {(quotePaper?.customer_phone ?? doc.customer_snapshot.phone) || "—"}</p>
        {isQuotation && <><p><strong>สถานที่ก่อสร้าง</strong> {quotePaper?.site_address || "—"}</p><p><strong>ฝ่ายขาย</strong> {(quotePaper?.salesperson ?? doc.customer_snapshot.salesperson) || "—"}</p></>}
        {receipt && <p><strong>ผู้ชำระ</strong> {receipt.payer_name}</p>}</section>
      {receipt && <>{receipt.replaces_number && <p>ออกแทนใบเสร็จเลขที่ {receipt.replaces_number}{receipt.replacement_reason ? ` · ${receipt.replacement_reason}` : ""}</p>}
        <table className={styles.table}><thead><tr><th>รายการ</th><th>จำนวนเงิน (บาท)</th></tr></thead><tbody><tr><td>{paymentKinds[receipt.kind]}<br />{receipt.description}</td><td>{formatMoney(receipt.amount_cents)}</td></tr></tbody>
        <tfoot><tr><th>รวมรับชำระ</th><td>{formatMoney(receipt.amount_cents)}</td></tr></tfoot></table>
        <p>รับเงินโดย {paymentMethods[receipt.method]} · วันที่รับเงินจริง {receipt.paid_date}</p>
        <div className={styles.signatures}><div><p>ผู้ชำระเงิน</p><p>________________________</p><p>{receipt.payer_name}</p></div><div><p>ผู้รับเงิน / ผู้ออกเอกสาร</p><p>________________________</p><p>{receipt.confirmed_by_name}</p></div></div></>}
      {agreement && <>{isQuotation ? <QuotationContent payload={agreement} date={doc.document_date} /> : <AgreementContent payload={{ ...agreement, ...(isTextAddendum && !agreement.customer ? { customer: { full_name: doc.customer_snapshot.full_name, phone: doc.customer_snapshot.phone, site_address: "" } } : {}) }} number={doc.number} />}
        {!quotePaper && !isPaperContract && <div className={styles.signatures}><div><p>{issuer.brand === "TARAVILLE" ? "ผู้ซื้อ" : "ผู้ว่าจ้าง / ลูกค้า"}</p><p>________________________</p><p>{doc.customer_snapshot.full_name}</p></div><div><p>{issuer.brand === "TARAVILLE" ? "ผู้ขาย" : "ผู้รับจ้าง / บริษัท"}</p><p>________________________</p><p>{issuer.legal_name}</p></div></div>}
      </>}
      {invoice && <><table className={styles.table}><thead><tr><th>รายการ</th><th>จำนวนเงิน (บาท)</th></tr></thead><tbody><tr><td>{invoice.label}</td><td>{formatMoney(invoice.gross_cents)}</td></tr><tr><td>หักเครดิตจากเงินที่รับไว้</td><td>{formatMoney(invoice.credit_cents)}</td></tr></tbody>
        <tfoot><tr><th>ยอดต้องชำระตามเอกสาร</th><td>{formatMoney(invoice.net_cents)}</td></tr></tfoot></table><p>ครบกำหนด {invoice.due_date}</p>
        {invoice.payment_due_days === 30 && invoice.acceptance_date && <p>ชำระภายใน 30 วันปฏิทินหลังวันที่ตรวจรับจริง {formatDate(invoice.acceptance_date)}</p>}
        {invoice.credit_settled && doc.adjustments.length === 0 && <p>งวดนี้ชำระครบด้วยเครดิตเงินเดิม ไม่มีการรับเงินใหม่หรือออกใบเสร็จใหม่</p>}
      </>}
      {invoiceAdjustments}
      {refund && <><p className={styles.content}>{refund.reason}</p><p><strong>จ่ายคืน {formatMoney(refund.amount_cents)} บาท</strong></p><p>วันที่จ่ายคืน {refund.paid_date} · {paymentMethods[refund.method]}</p><p>อ้างอิงการรับเงินและการอนุมัติคืนเงินที่บันทึกไว้ในระบบ</p></>}
      {adjustment && <>
        {adjustment.contract_number && <p>อ้างอิงสัญญา {adjustment.contract_number} · โครงการ {adjustment.development} · แปลงใหม่ {adjustment.plot}</p>}
        <p className={styles.content}>{adjustment.reason}</p><p className={styles.content}>{adjustment.agreement_text}</p>
        {adjustment.total_cents && <p>ยอดสัญญาหลังแก้ไข {formatMoney(adjustment.total_cents)} บาท</p>}
        {adjustment.retained_cents && <p>ยอดตามข้อตกลงปิดงาน {formatMoney(adjustment.retained_cents)} บาท</p>}
        {adjustment.received_cents && <p>รับสุทธิ ณ วันปิดงาน {formatMoney(adjustment.received_cents)} บาท</p>}
        {adjustment.remaining_cents && <p>ยอดคงต้องรับ ณ วันปิดงาน {formatMoney(adjustment.remaining_cents)} บาท</p>}
        {adjustment.refund_due_cents && <p>ยอดคงต้องคืน ณ วันปิดงาน {formatMoney(adjustment.refund_due_cents)} บาท</p>}
      </>}
      {summary && <>
        <p>โครงการ {summary.development} · แปลง {summary.plot}</p>
        <p>ชื่อเล่น {doc.customer_snapshot.nickname || "—"} · ฝ่ายขาย {doc.customer_snapshot.salesperson || "—"}</p>
        <table className={styles.table}><tbody>{[
          ["แบบบ้าน", "model"], ["จำนวนชั้น", "stories"], ["ห้องนอน", "bedrooms"], ["ห้องน้ำ", "bathrooms"],
          ["พื้นที่ใช้สอย (ตร.ม.)", "usable_area"], ["เนื้อที่ดิน (ตร.ว.)", "land_area"],
        ].map(([label, key]) => {
          const value = summary.details[key];
          return <tr key={key}><th>{label}</th><td>{typeof value === "number" || (typeof value === "string" && value) ? value : "—"}</td></tr>;
        })}</tbody></table>
        <table className={styles.table}><tbody>{[
          ["ราคาขาย", summary.list_cents], ["ราคาโปรโมชั่น", summary.promotion_cents], ["ส่วนลด", summary.discount_cents],
          ["ราคาสุทธิ", summary.total_cents], ["จอง", summary.booking_cents], ["วันทำสัญญา", summary.contract_cents],
          ["ดาวน์รวม", summary.down_cents], ["ยอดคงเหลือ", summary.balance_cents], ["ยอดยื่นกู้", summary.mortgage_cents],
        ].map(([label, value]) => <tr key={label}><th>{label}</th><td>{value == null ? "—" : `${formatMoney(value)} บาท`}</td></tr>)}</tbody></table>
        <p>วันนัดจอง {summary.booking_date || "—"} · วันนัดทำสัญญา {summary.contract_date || "—"} · วันนัดดาวน์งวดแรก {summary.down_date || "—"}</p>
        <p className={styles.content}>เงื่อนไข {summary.conditions || "—"}</p>
        <p className={styles.content}>ของแถม {summary.freebies || "—"}</p>
      </>}
    </article>
  </main>;
}
