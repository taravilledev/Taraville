import type { z } from "zod";
import type { agreementPayloadSchema } from "@/lib/sales/agreement-models";
import { formatMoney } from "@/lib/sales/money";
import styles from "./document.module.css";
import paper from "../../[id]/tasks/contract-paper.module.css";

import { ContractAddendumContent, PhotoContractContent } from "./photo-contract-content";

export function AgreementContent({ payload, number }: { payload: z.infer<typeof agreementPayloadSchema>; number?: string | null }) {
  if (payload.text_addendum) return <ContractAddendumContent payload={payload} />;
  if (payload.contract_paper) return <PhotoContractContent payload={payload} number={number} />;
  if (payload.customer && payload.schedule) return <div className={paper.pages} aria-label="ตัวอย่างสัญญาแบบเอกสาร">
    <article className={paper.sheet} aria-label="สัญญา หน้า 1"><p className={paper.pageNumber}>หน้า 1 / 4</p><h3>สัญญาก่อสร้าง</h3>
      <h4>ข้อสัญญามาตรฐาน</h4><p className={paper.text}>{payload.contract_text || "ยังไม่มีข้อความสัญญามาตรฐานที่บริษัทกำหนด"}</p>
    </article>
    <article className={paper.sheet} aria-label="สัญญา หน้า 2"><p className={paper.pageNumber}>หน้า 2 / 4</p><h3>ผู้ลงนามและขอบเขตงาน</h3>
      <p><strong>ผู้ว่าจ้าง</strong> {payload.customer.full_name}</p><p><strong>โทรศัพท์</strong> {payload.customer.phone}</p>
      <p className={paper.text}><strong>สถานที่ก่อสร้าง</strong> {payload.customer.site_address}</p><p><strong>วันเริ่มสัญญา</strong> {payload.start_date || "—"}</p>
      {payload.house && <p>{payload.house.model} · {payload.house.stories} ชั้น · {payload.house.usable_area} ตร.ม. · {payload.house.bedrooms} ห้องนอน · {payload.house.kitchens} ห้องครัว · {payload.house.bathrooms} ห้องน้ำ</p>}
      <p><strong>{payload.design_fee_separate ? "ราคาสัญญาค่าก่อสร้าง" : "ราคาสัญญารวมค่าออกแบบ"} {formatMoney(payload.total_cents ?? "0")} บาท</strong></p>
      {payload.description && <p className={paper.text}>{payload.description}</p>}
      {!!payload.spec_rows?.length && <><h4>สเปกตามใบเสนอราคาที่ลูกค้ายอมรับ</h4><table className={paper.table}><thead><tr><th>รายการ</th><th>รายละเอียด</th><th>หมายเหตุ</th></tr></thead><tbody>{payload.spec_rows.map((row, index) => <tr key={index}><th scope="row">{row.item}</th><td>{row.detail}</td><td>{row.note}</td></tr>)}</tbody></table></>}
      {!!payload.exclusions?.length && <><h4>รายการที่ไม่รวมตามใบเสนอราคา</h4><ul>{payload.exclusions.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
      <div className={paper.signatures}><div><p>ลงชื่อ ________________________</p><p>{payload.customer.full_name}</p><p>ผู้ว่าจ้าง</p></div><div><p>ลงชื่อ ________________________</p><p>ผู้รับจ้าง / บริษัท</p></div></div>
    </article>
    <article className={paper.sheet} aria-label="สัญญา หน้า 3"><p className={paper.pageNumber}>หน้า 3 / 4</p><h3>งวดงานและการชำระเงิน</h3>
      <p>{payload.design_fee_separate ? "ค่าออกแบบชำระแยกตามใบแจ้งชำระค่าออกแบบ" : `เงินค่าออกแบบที่รับไว้และนำมาเป็นเครดิต ${formatMoney(payload.credit_cents ?? "0")} บาท`}</p>
      <table className={paper.table}><thead><tr><th>งวด / งาน</th><th>ยอดเต็ม</th><th>เครดิตเดิม</th><th>ชำระเพิ่ม (บาท)</th></tr></thead><tbody>{payload.schedule.map(row => <tr key={row.position}><td>{row.label}{row.basis_points != null ? ` · ${row.basis_points / 100}%` : ""}{row.progress_percent != null ? ` · งาน ${row.progress_percent}%` : ""}<br />{row.work_description}</td><td>{formatMoney(row.gross_cents)}</td><td>{formatMoney(row.credit_cents)}</td><td>{formatMoney(row.net_cents)}</td></tr>)}</tbody></table>
    </article>
    <article className={paper.sheet} aria-label="สัญญา หน้า 4"><p className={paper.pageNumber}>หน้า 4 / 4</p><h3>ข้อตกลงเพิ่มเติมเฉพาะโครงการ</h3>
      <p className={paper.text}>{payload.additional_terms || "ไม่มีข้อตกลงเพิ่มเติม"}</p>
    </article>
  </div>;
  return <>
    {payload.customer && <p>ผู้ลงนาม {payload.customer.full_name} · โทร {payload.customer.phone}<br />สถานที่ก่อสร้าง {payload.customer.site_address}</p>}
    {payload.start_date && <p>วันเริ่มสัญญา {payload.start_date}</p>}
    {payload.house && <table className={styles.table}><tbody>{[
      ["แบบบ้าน", payload.house.model], ["จำนวนชั้น", payload.house.stories],
      ["ห้องนอน", payload.house.bedrooms], ["ห้องครัว", payload.house.kitchens],
      ["ห้องน้ำ", payload.house.bathrooms], ["พื้นที่ใช้สอย (ตร.ม.)", payload.house.usable_area],
    ].map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table>}
    {payload.description && <p className={styles.content}>{payload.description}</p>}
    <p><strong>{payload.price_set === false ? "ประมาณราคา · ยังไม่ระบุราคา" : `ราคารวม ${formatMoney(payload.total_cents ?? "0")} บาท`}</strong></p>
    {!!payload.spec_rows?.length && <table className={styles.table}><thead><tr><th>รายการ</th><th>รายละเอียด</th><th>หมายเหตุ</th></tr></thead>
      <tbody>{payload.spec_rows.map((row, index) => <tr key={index}><th>{row.item}</th><td className={styles.content}>{row.detail}</td><td>{row.note}</td></tr>)}</tbody></table>}
    {!!payload.exclusions?.length && <><h3>รายการที่ไม่รวม</h3><ul>{payload.exclusions.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
    {payload.schedule && <><p>เงินที่รับไว้และนำมาเป็นเครดิต {formatMoney(payload.credit_cents ?? "0")} บาท</p>
      <table className={styles.table}><thead><tr><th>งวด</th><th>ยอดเต็ม</th><th>เครดิตเดิม</th><th>สุทธิ (บาท)</th></tr></thead>
        <tbody>{payload.schedule.map(row => <tr key={row.position}><td>{row.label}{row.progress_percent != null ? ` (${row.progress_percent}%)` : ""}<br />{row.work_description}</td>
          <td>{formatMoney(row.gross_cents)}</td><td>{formatMoney(row.credit_cents)}</td><td>{formatMoney(row.net_cents)}</td></tr>)}</tbody></table></>}
    {payload.contract_text && <p className={styles.content}>{payload.contract_text}</p>}
  </>;
}
