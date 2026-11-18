import type { ReactNode } from "react";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import { contractMoneyText } from "./contract-money-text";
import styles from "./receipt-paper.module.css";

type Props = {
  issuer?: { legal_name: string; address: string; contact: string; tax_id: string };
  customer: { full_name: string; address?: string; phone?: string; salesperson?: string };
  number?: string | null;
  date?: string;
  paidDate?: string;
  method?: "cash" | "transfer" | "cheque";
  payerName?: string;
  receiverName?: string;
  label: string;
  description?: string;
  amountCents: string;
  isInstalment?: boolean;
  isPreview?: boolean;
  notice?: string;
  replacement?: string;
  invoice?: { dueDate?: string; grossCents: string; creditCents?: string; acceptanceDate?: string; isCreditSettled?: boolean };
  children?: ReactNode;
};

const methods = [["cash", "เงินสด"], ["transfer", "โอน"], ["cheque", "เช็ค"]] as const;
const buildingTypes = ["บ้านเดี่ยว", "ทาวน์โฮม", "อาคารพาณิชย์", "อื่น ๆ", "ขาย", "ต่อเติม"];
const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

function documentDate(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? formatDate(value) : dateFormat.format(date);
}

function CheckMark({ label, checked = false }: { label: string; checked?: boolean }) {
  return <span className={styles.choice} data-checked={checked}>
    <span className={styles.checkbox} aria-hidden="true">{checked ? "✓" : ""}</span>{label}
  </span>;
}

export function ReceiptPaper({ issuer, customer, number, date, paidDate, method, payerName, receiverName, label, description,
  amountCents, isInstalment, isPreview, notice, replacement, invoice, children }: Props) {
  const amount = formatMoney(amountCents);
  const Heading = isPreview ? "h3" : "h1";
  const title = invoice?.isCreditSettled ? "สรุปชำระด้วยเครดิตเดิม" : invoice ? "ใบแจ้งชำระ" : "ใบเสร็จรับเงิน";
  return <article className={styles.receipt} data-issued={!isPreview} aria-label={isPreview ? invoice ? "ตัวอย่างใบแจ้งชำระ" : "ตัวอย่างใบเสร็จ" : title}>
    {notice && <p className={styles.notice}>{notice}</p>}
    <header className={styles.header}>
      <Heading>{title}</Heading>
      <p className={styles.issuer}>{issuer?.legal_name || "บ้านคุณภาพ"}</p>
      <p className={styles.contact}>{[issuer?.address, issuer?.contact, issuer?.tax_id && `เลขประจำตัวผู้เสียภาษี ${issuer.tax_id}`].filter(Boolean).join(" · ")}</p>
    </header>
    <div className={styles.details}>
      <dl>
        <div><dt>ชื่อลูกค้า</dt><dd>{customer.full_name}</dd></div>
        <div><dt>ที่อยู่</dt><dd>{customer.address || "—"}</dd></div>
        <div><dt>โทรศัพท์</dt><dd>{customer.phone || "—"}</dd></div>
        <div><dt>เลขประจำตัวผู้เสียภาษี</dt><dd>—</dd></div>
      </dl>
      <div className={styles.property} aria-label="ประเภทงาน">
        {buildingTypes.map(type => <CheckMark key={type} label={type} />)}
      </div>
      <dl>
        <div><dt>เลขที่เอกสาร</dt><dd>{number ?? (isPreview ? "ยังไม่ออกเลข" : "—")}</dd></div>
        <div><dt>วันที่</dt><dd>{documentDate(date ?? paidDate)}</dd></div>
        {invoice && <div><dt>วันครบกำหนด</dt><dd><strong>{documentDate(invoice.dueDate)}</strong></dd></div>}
        <div><dt>แปลงที่</dt><dd>—</dd></div>
        <div><dt>ฝ่ายขาย</dt><dd>{customer.salesperson || "—"}</dd></div>
      </dl>
    </div>
    {invoice ? <div className={styles.payment}>
      {invoice.acceptanceDate && <span>วันที่ตรวจรับจริง · ชำระภายใน 30 วัน ({documentDate(invoice.acceptanceDate)})</span>}
    </div> : <div className={styles.payment} aria-label={method ? `วิธีชำระ ${methods.find(([key]) => key === method)?.[1]}` : "วิธีชำระยังไม่ระบุ"}>
      {methods.map(([key, label]) => <CheckMark key={key} label={label} checked={method === key} />)}
      {payerName && <span>ผู้ชำระ {payerName}</span>}
      {paidDate && date && paidDate !== date && <span>รับเงินจริง {documentDate(paidDate)}</span>}
    </div>}
    {replacement && <p className={styles.replacement}>{replacement}</p>}
    <div className={styles.items}>
      <table>
        <thead><tr><th scope="col">รายการ</th><th scope="col">จำนวน</th><th scope="col">หน่วย</th><th scope="col">รวมเงิน</th></tr></thead>
        <tbody><tr><td>{description || label}{description && description !== label && <small>{label}</small>}</td>
          <td>1.00</td><td>{isInstalment ? "งวด" : "รายการ"}</td><td>{invoice ? formatMoney(invoice.grossCents) : amount}</td></tr>
          {invoice?.creditCents && invoice.creditCents !== "0" && <tr><td colSpan={3}>หักเครดิตจากเงินที่รับไว้</td><td>{formatMoney(invoice.creditCents)}</td></tr>}
        </tbody>
      </table>
    </div>
    <div className={styles.totals}>
      <div className={styles.words}><span>จำนวนเงิน (ตัวหนังสือ)</span><strong>{contractMoneyText(amountCents)}</strong></div>
      <div className={styles.total}><span>{invoice ? "ยอดต้องชำระตามเอกสาร" : isPreview ? "ยอดรับที่รอยืนยัน" : "รวมทั้งสิ้น"}</span><strong>{amount} บาท</strong></div>
    </div>
    <footer className={styles.footer}>
      <div className={styles.signatures}>
        <div><span>ผู้อนุมัติ</span><span className={styles.signatureLine} /></div>
        <div><span>{invoice ? "ผู้ออกเอกสาร" : "ผู้รับเงิน"}</span><span className={styles.signatureLine} />{receiverName && <p>({receiverName})</p>}</div>
      </div>
      {method === "cheque" && <p>กรณีชำระด้วยเช็ค ใบเสร็จสมบูรณ์เมื่อบริษัทเรียกเก็บเงินตามเช็คเรียบร้อยแล้ว</p>}
      {invoice && <p>{invoice.isCreditSettled && !children ? "งวดนี้ชำระครบด้วยเครดิตเงินเดิม ไม่มีการรับเงินใหม่หรือออกใบเสร็จใหม่" : "เอกสารนี้ใช้แจ้งยอดชำระ"}</p>}
    </footer>
    {children}
  </article>;
}
