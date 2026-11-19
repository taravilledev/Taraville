import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const nationalId = z.string().regex(/^(?:\d{13})?$/);
export const contractPaperSchema = z.object({
  schema_version: z.literal(1), signing_place: text(2000), signing_date: z.union([z.literal(""), z.iso.date()]),
  employer_address: text(2000), employer_national_id: nationalId,
  contractor_name: text(300), contractor_address: text(3000), contractor_representative: text(200),
  contractor_national_id: nationalId, witness_1: text(200), witness_2: text(200),
  duration_days: z.string().regex(/^(?:[1-9]\d{0,3})?$/), extra_clauses: text(3000).min(1).array().max(50),
  conditions: text(10000), notes: text(10000),
  payment_due_days: z.literal(30).optional(),
}).strict();
export type ContractPaper = z.infer<typeof contractPaperSchema>;
export const emptyContractPaper: ContractPaper = { schema_version: 1, signing_place: "", signing_date: "", employer_address: "", employer_national_id: "",
  contractor_name: "", contractor_address: "", contractor_representative: "", contractor_national_id: "", witness_1: "", witness_2: "", duration_days: "", extra_clauses: [], conditions: "", notes: "" };
export function contractEndDate(start: string, days: string) {
  if (!z.iso.date().safeParse(start).success || !/^[1-9]\d{0,3}$/.test(days)) return "";
  const date = new Date(start + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + Number(days) - 1);
  return date.toISOString().slice(0, 10);
}
export function contractPaperMissing(paper: ContractPaper, allowPendingText = false) {
  const required = { signing_place: "สถานที่ทำสัญญา", signing_date: "วันทำสัญญา", employer_address: "ที่อยู่ผู้ว่าจ้าง",
    contractor_name: "ชื่อผู้รับจ้าง", contractor_address: "ที่อยู่ผู้รับจ้าง", contractor_representative: "ผู้แทนบริษัท", duration_days: "จำนวนวันก่อสร้าง" };
  return [...Object.entries(required).filter(([key]) => !paper[key as keyof ContractPaper]).map(([, label]) => label),
    ...(!allowPendingText && paper.extra_clauses.some(clause => clause.includes("รอตรวจต้นฉบับ")) ? ["ข้อสัญญาเพิ่มเติมที่รอตรวจต้นฉบับ"] : [])];
}
export const contractAddendumSchema = z.object({ date: z.iso.date(), extra_clauses: text(3000).min(1).array().max(50), conditions: text(10000), notes: text(10000) }).strict()
  .refine(value => value.extra_clauses.length > 0 || !!value.conditions || !!value.notes, "กรอกข้อตกลงเพิ่มเติมอย่างน้อยหนึ่งส่วน");
