import type { z } from "zod";
import type { agreementPayloadSchema } from "@/lib/sales/agreement-models";
import { contractEndDate, type ContractPaper } from "@/lib/sales/contract-paper";
import { formatMoney } from "@/lib/sales/money";
import { contractMoneyText } from "./contract-money-text";
import styles from "../../[id]/tasks/contract-paper.module.css";

type Payload = z.infer<typeof agreementPayloadSchema>;
const dateText = (date?: string) => date ? new Date(date + "T00:00:00Z").toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "________________";
export function ContractSignatures({ employer, paper }: { employer?: string; paper?: ContractPaper }) {
  return <div className={styles.signatures}>{[
    ["ผู้ว่าจ้าง", employer], ["ผู้รับจ้าง", paper?.contractor_representative],
    ["พยานฝ่ายผู้ว่าจ้าง", paper?.witness_1], ["พยานฝ่ายผู้รับจ้าง", paper?.witness_2],
  ].map(([label, name]) => <div key={label}>ลงชื่อ ____________________ {label}<br />{name ? `(${name})` : "(____________________)"}</div>)}</div>;
}
function NumberedClauses({ clauses, start = 15 }: { clauses: string[]; start?: number }) {
  return clauses.length ? <ol className={styles.text} start={start}>{clauses.map((clause, index) => <li key={index}>{clause}</li>)}</ol> : null;
}
function AnnexNotes({ conditions, notes }: { conditions: string; notes: string }) {
  return <>{conditions && <section><h4>เงื่อนไข</h4><p className={styles.text}>{conditions}</p></section>}
    {notes && <section><h4>หมายเหตุ</h4><p className={styles.text}>{notes}</p></section>}</>;
}
export function ContractAddendumContent({ payload }: { payload: Payload }) {
  const addendum = payload.text_addendum;
  if (!addendum) return null;
  return <article className={styles.sheet} aria-label="บันทึกข้อตกลงแนบท้ายสัญญา">
    <h3 className={styles.center}>บันทึกข้อตกลงแนบท้ายสัญญา</h3>
    <p>อ้างอิงสัญญาเลขที่ {payload.contract_number} · วันที่ {dateText(addendum.date)}</p>
    <p>ผู้ว่าจ้าง {payload.customer?.full_name || "________________"}</p>
    <NumberedClauses clauses={addendum.extra_clauses} start={1} /><AnnexNotes conditions={addendum.conditions} notes={addendum.notes} />
    <ContractSignatures employer={payload.customer?.full_name} paper={payload.contract_paper} />
  </article>;
}
export function PhotoContractContent({ payload, number, notice }: { payload: Payload; number?: string | null; notice?: string }) {
  const paper = payload.contract_paper!;
  const rows = payload.schedule ?? [];
  const hasAnnex = !!(paper.conditions || paper.notes);
  const customer = payload.customer;
  const end = contractEndDate(payload.start_date ?? "", paper.duration_days);
  const house = payload.house;
  const credit = payload.credit_cents ?? "0";
  const net = rows.reduce((sum, row) => sum + BigInt(row.net_cents), BigInt(0));
  const total = payload.total_cents ?? "0";
  const deposit = rows[0];
  const workRows = rows.slice(1);
  const workGross = workRows.reduce((sum, row) => sum + BigInt(row.gross_cents), BigInt(0));
  const hasPaymentTerm = paper.payment_due_days === 30;
  const line = (value?: string) => <span className={styles.blank}>{value || "________________"}</span>;
  const amount = (cents: string) => <>{line(formatMoney(cents))} บาท ({contractMoneyText(cents)})</>;
  const pageNumber = (position: number) => <p className={styles.photoPageNumber}>{position}</p>;
  const signatures = <ContractSignatures employer={customer?.full_name} paper={paper} />;
  const sheet = `${styles.sheet} ${styles.photoSheet}`;
  const stateNotice = notice && <p className={styles.notice}>{notice}</p>;
  return <div className={styles.pages} aria-label="ตัวอย่างสัญญาแบบเอกสาร">
    <article className={sheet} aria-label="สัญญา หน้า 1">{stateNotice}
      <h3 className={styles.contractTitle}>สัญญารับเหมาก่อสร้าง</h3>
      <div className={styles.documentMeta}><p>เลขที่สัญญา {line(number || "ยังไม่ออกเลข")}</p>
        <p>ทำที่ {line(paper.signing_place)}</p><p>วันที่ {line(dateText(paper.signing_date))}</p></div>
      <div className={styles.legalBody}>
        <p>สัญญาฉบับนี้ทำขึ้นระหว่าง {line(customer?.full_name)} เลขประจำตัวประชาชน {line(paper.employer_national_id)}
          ที่อยู่ {line(paper.employer_address)} โทรศัพท์ {line(customer?.phone)} ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้ว่าจ้าง”</strong> ฝ่ายหนึ่ง</p>
        <p>กับ {line(paper.contractor_name)} โดย {line(paper.contractor_representative)} เลขประจำตัวประชาชนผู้แทน {line(paper.contractor_national_id)}
          ที่อยู่ {line(paper.contractor_address)} ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้รับจ้าง”</strong> อีกฝ่ายหนึ่ง</p>
        <p>ทั้งสองฝ่ายตกลงทำสัญญารับเหมาก่อสร้าง โดยมีรายละเอียดข้อมูลและค่าจ้างดังต่อไปนี้</p>
        <p><strong>ข้อ 1.</strong> ผู้ว่าจ้างตกลงจ้าง และผู้รับจ้างตกลงรับจ้าง {line(house?.model)} ตามรายละเอียดแบบและเอกสารแนบท้ายสัญญา
          {house && <> จำนวน {line(house.stories)} ชั้น {line(house.bedrooms)} ห้องนอน {line(house.bathrooms)} ห้องน้ำ {line(house.kitchens)} ห้องครัว พื้นที่ใช้สอย {line(house.usable_area)} ตร.ม.</>}</p>
        <p className={styles.subClause}>1.1) สถานที่ก่อสร้าง ตั้งอยู่ที่ {line(customer?.site_address)}</p>
        <p className={styles.subClause}>1.2) กำหนดงานแล้วเสร็จ {line(paper.duration_days)} วัน โดยเริ่มตั้งแต่วันที่ {line(dateText(payload.start_date))} ถึงวันที่ {line(dateText(end))}</p>
        <p><strong>ข้อ 2.</strong> ผู้ว่าจ้างตกลงชำระค่าจ้างตามรายละเอียดในข้อ 1 รวมทั้งสิ้น {amount(total)} โดยมีรายละเอียดการชำระดังนี้</p>
        <p className={styles.subClause}>2.1) {payload.design_fee_separate ? "ค่าออกแบบชำระแยกตามใบแจ้งชำระค่าออกแบบ" : <>ค่าออกแบบที่รับชำระแล้ว {amount(credit)} เป็นส่วนหนึ่งของค่าจ้างรวม และนำไปหักเป็นเครดิตตามตารางงวดแนบท้าย</>}</p>
        {deposit && <p className={styles.subClause}>2.2) งวดมัดจำวันลงนามสัญญา {amount(deposit.gross_cents)}</p>}
        <p className={styles.subClause}>2.3) ค่าจ้างงวดงานที่เหลือ {amount(workGross.toString())} แบ่งเป็น {line(String(workRows.length))} งวด ตามความคืบหน้าของงานดังนี้</p>
        <div className={styles.paymentClauses}>{workRows.map((row, index) => <p key={row.position}>
          <strong>{index === workRows.length - 1 ? "งวดสุดท้าย" : `งวดที่ ${index + 1}`}</strong> {row.label}
          {row.progress_percent != null && <> เมื่อความคืบหน้างาน {line(String(row.progress_percent))}%</>} เป็นเงิน {line(formatMoney(row.gross_cents))} บาท
          {row.basis_points != null && <> หรือ {line(String(row.basis_points / 100))}% ของค่าจ้างรวม</>}
          {row.work_description && <span className={styles.workDescription}>{row.work_description}</span>}
        </p>)}</div>
        {hasPaymentTerm && <p className={styles.paymentTerm}>การชำระงวดงานที่ต้องตรวจรับ ให้ชำระภายใน 30 วันปฏิทินนับจากวันที่ตรวจรับงานจริงตามที่บันทึกไว้ในระบบ ทั้งนี้งวดมัดจำและค่าออกแบบเป็นไปตามเงื่อนไขของรายการนั้น</p>}
      </div>
      {pageNumber(1)}
    </article>
    <article className={sheet} aria-label="สัญญา หน้า 2">{stateNotice}
      <div className={styles.legalBody}>
        {!payload.contract_text_approved && <p className={styles.notice}>รอตรวจข้อความบริษัท · ข้อ 3–14 และถ้อยคำที่ยังอ่านไม่ครบต้องตรวจต้นฉบับก่อนใช้กับธุรกรรมจริง</p>}
        <h4>ข้อสัญญามาตรฐานของบริษัท</h4>
        <p className={styles.text}>{payload.contract_text || "[ข้อความสัญญาข้อ 3–14 — รอบริษัทส่งและตรวจข้อความต้นฉบับ]"}</p>
        <NumberedClauses clauses={paper.extra_clauses} />
      </div>
      <p className={styles.executionNote}>สัญญานี้ทำขึ้นเป็นสองฉบับ มีข้อความถูกต้องตรงกันทุกประการ คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยตลอดแล้ว เห็นว่าถูกต้องตรงตามเจตนาของตน จึงได้ลงลายมือชื่อและประทับตราเป็นสำคัญ (ถ้ามี) ไว้เป็นหลักฐานต่อหน้าพยาน และต่างเก็บรักษาไว้ฝ่ายละฉบับ</p>
      {signatures}{pageNumber(2)}
    </article>
    <article className={sheet} aria-label="สัญญา หน้า 3">{stateNotice}
      <h3 className={styles.contractTitle}>บันทึกข้อตกลงแนบท้ายสัญญา</h3>
      <dl className={styles.annexHeader}>
        <div><dt>วันที่</dt><dd>{line(dateText(paper.signing_date))}</dd></div>
        <div><dt>สัญญาเลขที่</dt><dd>{line(number || "ยังไม่ออกเลข")}</dd></div>
        <div><dt>ผู้รับจ้าง</dt><dd>{line(paper.contractor_name)}</dd></div>
        <div><dt>ชื่อลูกค้า</dt><dd>{line(customer?.full_name)}</dd></div>
        <div className={styles.annexFull}><dt>สถานที่</dt><dd>{line(customer?.site_address)}</dd></div>
        <div><dt>แบบบ้าน</dt><dd>{line(house?.model)}</dd></div>
        <div><dt>พื้นที่ใช้สอย</dt><dd>{line(house?.usable_area)} ตร.ม.</dd></div>
        <div className={styles.annexFull}><dt>ลักษณะบ้าน</dt><dd>{line(house?.stories)} ชั้น · {line(house?.bedrooms)} ห้องนอน · {line(house?.bathrooms)} ห้องน้ำ · {line(house?.kitchens)} ห้องครัว</dd></div>
        <div className={styles.annexFull}><dt>ราคา (บาท)</dt><dd>{line(formatMoney(total))} ({contractMoneyText(total)})</dd></div>
      </dl>
      <div className={styles.tableScroll}><table className={`${styles.table} ${styles.photoTable}`}>
        <colgroup><col className={styles.instalmentColumn} /><col className={styles.progressColumn} /><col /><col className={styles.amountColumn} /><col className={styles.dateColumn} /></colgroup>
        <thead><tr><th scope="col">งวด</th><th scope="col">% งาน</th><th scope="col">งานที่ดำเนินการ</th><th scope="col">จำนวนเงิน (บาท)</th><th scope="col">วันที่ชำระ</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.position}>
          <th scope="row">{index === 0 ? "มัดจำ" : index}</th><td>{row.progress_percent == null ? "—" : `${row.progress_percent}%`}</td>
          <td>{row.label}{row.work_description && <span className={styles.workDescription}>{row.work_description}</span>}</td>
          <td>{formatMoney(row.gross_cents)}</td><td aria-label="เว้นไว้เขียนบนกระดาษ"></td>
        </tr>)}</tbody><tfoot><tr><th scope="row" colSpan={3}>รวมค่าจ้างตามสัญญา</th><td>{formatMoney(total)}</td><td /></tr></tfoot>
      </table></div>
      <div className={styles.creditSummary}><p>{payload.design_fee_separate ? "ค่าออกแบบชำระแยกตามใบแจ้งชำระค่าออกแบบ" : `หักเครดิตค่าออกแบบที่รับชำระแล้ว ${formatMoney(credit)} บาท`}</p><p><strong>ยอดชำระเพิ่มรวม {formatMoney(net.toString())} บาท</strong></p>
        {rows.some(row => row.credit_cents !== "0") && <p>การใช้เครดิตรายงวด: {rows.filter(row => row.credit_cents !== "0").map(row => `${row.label} หัก ${formatMoney(row.credit_cents)} บาท คงชำระ ${formatMoney(row.net_cents)} บาท`).join(" · ")}</p>}
        <p>สัดส่วนค่าจ้าง (% เงิน): {rows.map(row => `${row.label} ${row.basis_points == null ? "—" : `${row.basis_points / 100}%`}`).join(" · ")}</p>
      </div>
      {hasPaymentTerm && <p className={styles.paymentTerm}>งวดงานชำระภายใน 30 วันปฏิทินหลังวันที่ตรวจรับงานจริง · ช่องวันที่ชำระเว้นไว้บันทึกการชำระบนกระดาษ</p>}
      <p className={styles.constructionDates}>เริ่มก่อสร้าง {line(dateText(payload.start_date))} · ระยะเวลา {line(paper.duration_days)} วัน · สิ้นสุด {line(dateText(end))}</p>
      <p className={styles.annexReference}>ข้อตกลงแนบท้ายฉบับนี้เป็นส่วนหนึ่งของสัญญารับเหมาก่อสร้าง ลงวันที่ {line(dateText(paper.signing_date))}</p>
      {signatures}{pageNumber(3)}
    </article>
    {hasAnnex && <article className={sheet} aria-label="สัญญา หน้า 4">{stateNotice}
      <h3 className={styles.contractTitle}>บันทึกข้อตกลงแนบท้ายสัญญา (1)</h3>
      <p className={styles.documentMeta}>วันที่ {dateText(paper.signing_date)}</p>
      <p><strong>รับจ้าง {house?.model || "________________"}</strong></p>
      <AnnexNotes conditions={paper.conditions} notes={paper.notes} />
      <p className={styles.annexReference}>หนังสือแนบท้ายฉบับนี้เป็นส่วนหนึ่งของสัญญารับเหมาก่อสร้าง เลขที่ {line(number || "ยังไม่ออกเลข")} ลงวันที่ {line(dateText(paper.signing_date))}</p>
      {signatures}{pageNumber(4)}
    </article>}
  </div>;
}
