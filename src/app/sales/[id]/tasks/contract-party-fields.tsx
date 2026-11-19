import type { ContractPaper } from "@/lib/sales/contract-paper";
import styles from "./contract-paper.module.css";

type PaperField = Exclude<keyof ContractPaper, "schema_version" | "extra_clauses" | "payment_due_days">;
export const photoDraftClauses = [
  "กรณีมีการบอกเลิกสัญญาก่อนงานเสร็จสมบูรณ์ ไม่ว่าจากฝ่ายใด ผู้รับจ้างจะต้องขนย้ายวัสดุ สิ่งของ และเครื่องมือออกจากพื้นที่ทำงานตามข้อ 1.1 ภายใน 30 วัน [ผู้รับผิดชอบค่าใช้จ่ายและถ้อยคำส่วนที่เหลือ — รอตรวจต้นฉบับ]",
  "หากมีเหตุสุดวิสัยเกิดขึ้นกับคู่สัญญาฝ่ายใดฝ่ายหนึ่ง ทำให้ไม่สามารถปฏิบัติตามสัญญาได้ เช่น ภัยธรรมชาติหรือสงคราม [สิทธิในการบอกเลิกสัญญาและถ้อยคำส่วนที่เหลือ — รอตรวจต้นฉบับ]",
];
export const partyFields = [
  ["signing_place", "สถานที่ทำสัญญา", 2000], ["signing_date", "วันทำสัญญา", 10, "date"],
  ["employer_address", "ที่อยู่ผู้ว่าจ้าง", 2000], ["employer_national_id", "เลขบัตรประชาชนผู้ว่าจ้าง (ถ้ามี)", 13, "numeric"],
  ["contractor_name", "ชื่อผู้รับจ้าง / บริษัท", 300], ["contractor_address", "ที่อยู่ผู้รับจ้าง", 3000],
  ["contractor_representative", "ผู้แทนบริษัท", 200], ["contractor_national_id", "เลขบัตรประชาชนผู้แทน (ถ้ามี)", 13, "numeric"],
] as const;
export function ContractField({ name, label, max, kind, value, onChange }: { name: PaperField; label: string; max: number; kind?: "date" | "numeric"; value: string; onChange: (key: PaperField, value: string) => void }) {
  return <label htmlFor={`contract-${name}`}>{label}<input id={`contract-${name}`} type={kind === "date" ? "date" : "text"}
    inputMode={kind === "numeric" ? "numeric" : undefined} maxLength={max} value={value} onChange={event => onChange(name, event.target.value)} /></label>;
}
export function ContractClauses({ clauses, onChange, start = 15 }: { clauses: string[]; onChange: (value: string[]) => void; start?: number }) {
  return <div className={styles.pages}>
    {clauses.map((clause, index) => <div key={index}><label>ข้อ {index + start}<textarea maxLength={3000} value={clause}
      onChange={event => onChange(clauses.map((value, position) => index === position ? event.target.value : value))} /></label>
      <button type="button" className={styles.textButton} onClick={() => onChange(clauses.filter((_, position) => index !== position))}>นำข้อ {index + start} ออก</button></div>)}
    <button type="button" className={styles.textButton} disabled={clauses.length >= 50} onClick={() => onChange([...clauses, ""])}>เพิ่มข้อสัญญา</button>
  </div>;
}
