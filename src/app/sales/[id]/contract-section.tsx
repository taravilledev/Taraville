import Link from "next/link";
import { bkpWorkflow } from "@/lib/sales/bkp-workflow";
import { formatMoney } from "@/lib/sales/money";
import { findTask, taskHref, type TaskName } from "@/lib/sales/tasks";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { SummaryData } from "./summary-sections";
import { WorkspaceHeading } from "./workspace-heading";
import shared from "../sales.module.css";
import styles from "./workspace-section.module.css";

type Document = AgreementDetail["documents"][number];
const money = (value?: string) => value == null ? "ยังไม่ระบุ" : `${formatMoney(value)} บาท`;
const stateLabel = (doc: Document) => doc.state === "draft" ? "ร่าง · ยังไม่ออกเลข" : doc.state === "awaiting_signature"
  ? "ออกเลขแล้ว · รอลงนาม" : doc.state === "signed" ? "ลงนามแล้ว" : doc.state === "cancelled" ? "ยกเลิกแล้ว" : "เอกสารที่ออกแล้ว";

export function ContractSection({ data }: { data: SummaryData }) {
  const { sale, finance, agreement, tasks } = data;
  if (!finance || !agreement) return null;
  const contract = bkpWorkflow(finance, agreement).contract;
  const accepted = agreement.documents.filter(doc => doc.kind === "quotation" && doc.state === "accepted"
    && doc.payload.price_set !== false && BigInt(doc.payload.total_cents ?? "0") > BigInt(0));
  const reference = contract?.parent_id ? agreement.documents.find(doc => doc.id === contract.parent_id && doc.kind === "quotation") : undefined;
  const otherIssuedContracts = agreement.documents.filter(doc => doc.kind === "contract" && doc.id !== contract?.id
    && ["awaiting_signature", "signed"].includes(doc.state));
  const annexes = agreement.documents.filter(doc => doc.kind === "amendment" && doc.state !== "cancelled");
  const history = agreement.documents.filter(doc => (doc.kind === "contract" && doc.id !== contract?.id && !otherIssuedContracts.some(item => item.id === doc.id))
    || (doc.kind === "amendment" && doc.state === "cancelled")).sort((a, b) => b.revision - a.revision);
  const documentTasks = (doc: Document) => doc.state === "cancelled" ? [] : tasks.filter(task => task.row === doc.id
    && ["edit-contract", "lock-contract", "unlock-contract", "sign-contract", "contract-addendum"].includes(task.name));
  const historyActions = history.reduce((count, doc) => count + documentTasks(doc).length, 0);
  const action = (name: TaskName, label: string, row?: string, primary = false) => {
    const task = findTask(tasks, name, row);
    return task ? <Link key={`${name}:${row ?? ""}`} className={primary ? shared.primary : shared.link} href={taskHref(sale.id, name, row)} prefetch={false}>{label}</Link> : null;
  };
  const open = (doc: Document, label = "ดูสัญญาฉบับนี้") => <Link className={shared.link} href={`/sales/documents/${doc.id}`} prefetch={false}>{label}</Link>;
  const actionLabels: Partial<Record<TaskName, string>> = { "edit-contract": "แก้ไข / ตรวจร่าง", "lock-contract": "ตรวจความพร้อมก่อนออกเลข", "unlock-contract": "กลับไปแก้ร่าง",
    "sign-contract": "บันทึกลงนามสัญญา", "contract-addendum": "เพิ่มเอกสารแนบท้าย" };
  const hint = sale.status === "cancelled" ? "ตรวจเอกสารอ้างอิงและยอดตามข้อตกลงปิดงานในหน้าการเงิน"
    : contract?.state === "draft" ? "ตรวจข้อมูลคู่สัญญา ข้อสัญญาและตารางงวดก่อนออกเลข การมีร่างยังไม่แปลว่าข้อมูลครบหรือข้อความบริษัทพร้อมใช้"
    : contract?.state === "awaiting_signature" ? "เปิดตรวจและพิมพ์สัญญาฉบับนี้ เมื่อลงนามแล้วให้แนบหลักฐานเพื่อบันทึกการลงนาม"
      : "สัญญาลงนามแล้ว ติดตามตรวจรับงาน ออกบิลและรับชำระในหน้าการเงิน";
  const scheduleCount = contract?.payload.schedule?.length ?? contract?.payload.schedule_input?.length;
  const currentLabel = sale.status === "cancelled" ? "สัญญาอ้างอิงของโครงการยกเลิก" : contract?.state === "draft"
    ? "ร่างที่กำลังจัดทำ" : contract?.state === "awaiting_signature" ? "สัญญารอลงนาม" : "สัญญาที่ลงนาม";
  return <section className={styles.section} aria-labelledby="contract-section-title">
    <WorkspaceHeading caseId={sale.id} title="สัญญาและเอกสารแนบท้าย" titleId="contract-section-title"
      description={contract ? `${currentLabel} · ${stateLabel(contract)}` : "ยังไม่มีสัญญาที่ใช้งานอยู่"} />
    {sale.status === "cancelled" && <p className={shared.notice}>โครงการยกเลิกแล้ว เอกสารเดิมยังเปิดดูเพื่ออ้างอิงได้</p>}
    {contract ? <article className={`${styles.card} ${styles.current}`} aria-labelledby="current-contract-title">
      <div className={styles.rowHeading}><div><p className={styles.eyebrow}>{currentLabel} · ฉบับที่ {contract.revision}</p>
        <h3 id="current-contract-title">{contract.number ?? "ร่างสัญญา · ยังไม่ออกเลข"}</h3></div>
        <span className={styles.status} data-done={contract.state === "signed"} data-pending={contract.state === "awaiting_signature"}>{stateLabel(contract)}</span></div>
      <dl className={styles.facts}>
        <div><dt>มูลค่าตามสัญญา</dt><dd className={styles.amount}>{money(contract.payload.total_cents)}</dd></div>
        <div><dt>เครดิตค่าออกแบบตามฉบับนี้</dt><dd>{money(contract.payload.credit_cents)}</dd></div>
        <div><dt>ตารางงวดตามฉบับนี้</dt><dd>{scheduleCount == null ? "ยังไม่ระบุ" : `${scheduleCount} งวด`}</dd></div>
        <div><dt>ใบเสนอราคาอ้างอิง</dt><dd>{reference ? <Link href={`/sales/documents/${reference.id}`} prefetch={false}>{reference.number ?? "ใบเสนอราคา"} · ฉบับที่ {reference.revision}</Link> : "ยังไม่ระบุ"}</dd></div>
      </dl>
      <div className={styles.next}><p>{hint}</p>
        <div className={styles.actions}>
          {contract.state === "draft" && action("edit-contract", "แก้ไข / ตรวจร่าง", contract.id, true)}
          {contract.state === "awaiting_signature" && action("sign-contract", "บันทึกลงนามสัญญา", contract.id, true)}
          {contract.state === "signed" && <Link className={shared.primary} href={`/sales/${sale.id}?tab=money#schedule`} prefetch={false}>{sale.status === "cancelled" ? "ดูยอดและประวัติรับเงิน" : "ไปการเงิน · งวดสัญญา"}</Link>}
          {open(contract)}
          {contract.state === "draft" && action("lock-contract", "ตรวจความพร้อมก่อนออกเลข", contract.id)}
          {contract.state === "awaiting_signature" && action("unlock-contract", "กลับไปแก้ร่าง", contract.id)}
          {contract.state === "signed" && action("contract-addendum", "เพิ่มเอกสารแนบท้าย", contract.id)}
        </div>
        {contract.state === "awaiting_signature" && findTask(tasks, "unlock-contract", contract.id)
          && <p className={styles.note}>การกลับไปแก้ร่างจะเก็บเลขฉบับนี้เป็นเอกสารยกเลิก และออกเลขใหม่เมื่อล็อกร่างอีกครั้ง</p>}
        {contract.state === "draft" && <p className={styles.note}>หน้าตรวจความพร้อมจะตรวจข้อมูลที่จำเป็นและข้อความบริษัทอีกครั้ง เครดิตจะตรวจจากเงินที่ยืนยันแล้ว ณ ตอนออกเลข</p>}
        {contract.state !== "signed" && !documentTasks(contract).length && <p className={styles.note}>รอผู้มีสิทธิ์ดำเนินการตามสถานะสัญญา คุณยังเปิดอ่านเอกสารได้</p>}
      </div>
    </article> : <div className={styles.card}><h3>ยังไม่มีสัญญาที่ใช้งานอยู่</h3>
      <p>{sale.status === "cancelled" ? "ดูสัญญาฉบับเดิมและเอกสารยกเลิกได้จากประวัติด้านล่าง" : accepted.length
        ? "เริ่มร่างจากใบเสนอราคาที่ระบุราคาและลูกค้ายอมรับแล้ว ข้อมูลลูกค้า สถานที่และราคาจะส่งต่อไปยังร่าง"
        : "ต้องมีใบเสนอราคาที่ระบุราคาและลูกค้ายอมรับก่อนจัดทำสัญญา"}</p>
      {accepted.length > 0 && <><p className={styles.note}>ใบเสนอราคาที่ใช้เริ่มร่างได้ · เลือกฉบับอ้างอิงอีกครั้งในหน้าจัดทำร่าง</p>
        <ul className={styles.rows}>{accepted.map(doc => <li key={doc.id} className={styles.rowHeading}><div>
          <strong>{doc.number ?? "ใบเสนอราคา"} · ฉบับที่ {doc.revision}</strong><p>มูลค่าตามใบเสนอราคา {money(doc.payload.total_cents)}</p>
        </div>{open(doc, "ดูใบเสนอราคา")}</li>)}</ul></>}
      <div className={styles.actions}>{action("prepare-contract", "จัดทำร่างสัญญา", undefined, true)}
        <Link className={shared.link} href={`/sales/${sale.id}?tab=quotation`} prefetch={false}>ดูใบเสนอราคา</Link></div>
      {accepted.length > 0 && sale.status !== "cancelled" && !findTask(tasks, "prepare-contract", undefined)
        && <p className={styles.note}>รอผู้มีสิทธิ์จัดทำร่างสัญญา</p>}
    </div>}
    {otherIssuedContracts.map(doc => <article key={doc.id} className={styles.card}>
      <div className={styles.rowHeading}><div><p className={styles.eyebrow}>สัญญาที่ออกเลขแล้วซึ่งยังไม่ยกเลิก · ฉบับที่ {doc.revision}</p>
        <h3>{doc.number ?? "สัญญา"}</h3></div><span className={styles.status} data-done={doc.state === "signed"} data-pending={doc.state === "awaiting_signature"}>{stateLabel(doc)}</span></div>
      <p>มูลค่าตามสัญญา {money(doc.payload.total_cents)} · แสดงแยกจากฉบับที่กำลังดำเนินการด้านบน</p>
      <div className={styles.actions}>{open(doc)}{documentTasks(doc).map(task => action(task.name, actionLabels[task.name] ?? task.label, task.row))}</div>
    </article>)}
    {annexes.length > 0 && <section className={styles.card}><h3>เอกสารแนบท้ายและข้อตกลงที่ใช้งาน ({annexes.length})</h3>
      <ul className={styles.rows}>{annexes.map(doc => <li key={doc.id} className={styles.rowHeading}><div>
        <strong>{doc.payload.text_addendum ? "เอกสารแนบท้าย" : "ข้อตกลงแก้ไขสัญญา"} · {doc.number ?? "ยังไม่ออกเลข"}</strong>
        {doc.payload.contract_number && <p className={styles.note}>อ้างอิงสัญญา {doc.payload.contract_number}</p>}</div>{open(doc, "ดูเอกสาร")}</li>)}</ul>
    </section>}
    {history.length > 0 && <details className={styles.history} open={historyActions > 0}>
      <summary>ประวัติสัญญาและฉบับยกเลิก · {history.length} ฉบับ{historyActions > 0 && ` · มีงานที่ทำได้ ${historyActions} รายการ`}</summary>
      <ul>{history.map(doc => <li key={doc.id}><div><strong>{doc.number ?? "ร่างสัญญา · ยังไม่ออกเลข"} · ฉบับที่ {doc.revision}</strong>
        <p>{stateLabel(doc)} · {money(doc.payload.total_cents)}</p></div><div className={styles.actions}>{open(doc, "ดูเอกสาร")}
          {documentTasks(doc).map(task => action(task.name, actionLabels[task.name] ?? task.label, task.row))}</div></li>)}</ul>
    </details>}
  </section>;
}
