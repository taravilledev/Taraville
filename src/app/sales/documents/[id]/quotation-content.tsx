import type { z } from "zod";
import type { agreementPayloadSchema } from "@/lib/sales/agreement-models";
import { formatMoney } from "@/lib/sales/money";
import styles from "./document.module.css";

export function QuotationContent({ payload, date, part = "all" }: { payload: z.infer<typeof agreementPayloadSchema>; date: string; part?: "all" | "first" | "continuation" | "conditions" }) {
  const { house, paper } = payload;
  const displayDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${date}T00:00:00+07:00`));
  const rows = part === "first" ? payload.spec_rows?.slice(0, 8) : part === "continuation" ? payload.spec_rows?.slice(8) : payload.spec_rows;
  const showHouse = part === "all" || part === "first";
  const showConditions = part === "all" || part === "conditions";
  return <>
    {showHouse && <section className={styles.quoteHouse} aria-label="บ้านและราคาที่เสนอ">
      <p><strong>ประเภทงาน</strong> {paper?.work_type || "—"} · <strong>แบบบ้าน</strong> {house?.model || String(payload.details?.model ?? "—")}</p>
      {house && <p>{house.stories} ชั้น · {house.bedrooms} ห้องนอน · {house.kitchens} ห้องครัว · {house.bathrooms} ห้องน้ำ</p>}
      {house && <p><strong>พื้นที่ใช้สอย</strong> {house.usable_area} ตร.ม.</p>}
      <p className={styles.quoteTotal}>{payload.price_set === false ? "ประมาณราคา · ยังไม่ระบุราคา" : `${payload.design_fee_separate ? "ราคาก่อสร้าง" : "ราคารวม"} ${formatMoney(payload.total_cents ?? "0")} บาท`}</p>
      {payload.design_fee_separate && <p>ค่าออกแบบเรียกเก็บแยก</p>}
    </section>}
    {part !== "conditions" && <table className={`${styles.table} ${styles.quoteSpecs}`}><caption>รายละเอียดวัสดุและขอบเขตงาน{part === "continuation" ? " (ต่อ)" : ""}</caption>
      <thead><tr><th scope="col">รายการ</th><th scope="col">ประมาณราคา{showHouse && <span className={styles.tablePrice}>{payload.price_set === false ? "ยังไม่ระบุราคา" : `${formatMoney(payload.total_cents ?? "0")} บาท`}</span>}</th><th scope="col">หมายเหตุ</th></tr></thead>
      <tbody>{rows?.map((row, index) => <tr key={index}><th scope="row">{row.item}</th><td className={styles.content}>{row.detail || "—"}</td><td className={styles.content}>{row.note || "—"}</td></tr>)}</tbody>
    </table>}
    {showConditions && payload.description && <section className={styles.quoteTextSection} aria-label="รายละเอียดขอบเขตงานเพิ่มเติม"><h3>รายละเอียดขอบเขตงานเพิ่มเติม</h3><p className={styles.content}>{payload.description}</p></section>}
    {showConditions && !!payload.exclusions?.length && <section className={`${styles.quoteTextSection} ${styles.quoteConditions}`} aria-label="เงื่อนไขเพิ่มเติม"><h3>เงื่อนไขเพิ่มเติม</h3><ol>{payload.exclusions.map((item, index) => <li key={index}>{item}</li>)}</ol></section>}
    {showConditions && paper?.footnote && <section className={`${styles.quoteTextSection} ${styles.quoteFootnote}`} aria-label="หมายเหตุท้ายใบเสนอราคา"><h3>หมายเหตุ</h3><p className={styles.content}>{paper.footnote}</p></section>}
    {showConditions && paper && <div className={styles.signatures}>
      <div><p>ลงชื่อ ________________________</p><p>{paper.manager || "(                              )"}</p><p>ผู้จัดการ</p><p>วันที่ {displayDate}</p></div>
      <div><p>ลงชื่อ ________________________</p><p>{paper.salesperson || "(                              )"}</p><p>ผู้เสนอราคา</p><p>วันที่ {displayDate}</p></div>
    </div>}
  </>;
}
