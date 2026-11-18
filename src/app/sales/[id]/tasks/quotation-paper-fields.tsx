import type { z } from "zod";
import type { quotationPaperSchema } from "@/lib/sales/agreement-inputs";
import styles from "../../sales.module.css";

export type QuotationPaper = z.infer<typeof quotationPaperSchema>;
export const paperFields = [
  { key: "customer_name", label: "ชื่อลูกค้า", max: 200 }, { key: "customer_phone", label: "โทรศัพท์ลูกค้า", max: 80 },
  { key: "customer_address", label: "ที่อยู่ลูกค้า", max: 2000, multiline: true },
  { key: "site_address", label: "สถานที่ก่อสร้าง", max: 2000, multiline: true },
  { key: "salesperson", label: "ฝ่ายขาย / ผู้เสนอราคา", max: 200 }, { key: "manager", label: "ผู้จัดการ", max: 200 },
] as const;

export function QuotationPaperFields({ value, onChange, error }: {
  value: QuotationPaper; onChange: (value: QuotationPaper) => void; error?: string;
}) {
  return <div className={styles.grid}>{paperFields.filter(field => field.key !== "manager").map(field => <label className={styles.field} key={field.key}>{field.label}
    {"multiline" in field ? <textarea value={value[field.key]} maxLength={field.max} onChange={event => onChange({ ...value, [field.key]: event.target.value })} />
      : <input value={value[field.key]} maxLength={field.max} aria-invalid={field.key === "customer_name" && !!error}
        aria-describedby={field.key === "customer_name" && error ? "quote-customer-error" : undefined}
        onChange={event => onChange({ ...value, [field.key]: event.target.value })} />}
    {field.key === "customer_name" && error && <span id="quote-customer-error">{error}</span>}
  </label>)}
    <label className={styles.field}>วันที่ใบเสนอราคา<input type="date" required value={value.document_date} onChange={event => onChange({ ...value, document_date: event.target.value })} /></label>
    <label className={styles.field}>ประเภทงาน<select value={value.work_type} onChange={event => onChange({ ...value, work_type: event.target.value as QuotationPaper["work_type"] })}>
      <option value="">ยังไม่ระบุ</option>{["รับสร้างบ้าน", "ต่อเติม", "ปรับปรุง", "อื่นๆ"].map(item => <option key={item}>{item}</option>)}
    </select></label>
  </div>;
}
