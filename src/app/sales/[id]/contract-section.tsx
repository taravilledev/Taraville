import Link from "next/link";
import { bkpWorkflow } from "@/lib/sales/bkp-workflow";
import { formatMoney } from "@/lib/sales/money";
import { findTask, type TaskName } from "@/lib/sales/tasks";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { SummaryData } from "./summary-sections";
import type { TaskData } from "./tasks/task-data";
import { contractReadiness } from "./contract-readiness";
import { ContractSteps, type ContractStep } from "./contract-steps";
import { ContractTaskAction } from "./contract-drawers";
import { WorkspaceHeading } from "./workspace-heading";
import * as ws from "./workspace-styles";
import { noticeClass } from "@/components/notice";
import { Status, type StatusTone } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";

type Document = AgreementDetail["documents"][number];
const money = (value?: string) => value == null ? "ยังไม่ระบุ" : `${formatMoney(value)} บาท`;
const stateLabel = (doc: Document) => doc.state === "draft" ? "ร่าง · ยังไม่ออกเลข" : doc.state === "awaiting_signature"
  ? "ออกเลขแล้ว · รอลงนาม" : doc.state === "signed" ? "ลงนามแล้ว" : doc.state === "cancelled" ? "ยกเลิกแล้ว" : "เอกสารที่ออกแล้ว";
const stateTones: Record<string, StatusTone> = { draft: "progress", awaiting_signature: "waiting", signed: "success" };
const ContractState = ({ doc }: { doc: Document }) => <Status tone={stateTones[doc.state] ?? "inactive"}>{stateLabel(doc)}</Status>;
const actionLabels: Partial<Record<TaskName, string>> = { "edit-contract": "แก้ร่าง ›", "lock-contract": "ตรวจความพร้อมก่อนออกเลข ›", "unlock-contract": "กลับไปแก้ร่าง",
  "sign-contract": "บันทึกลงนามสัญญา", "contract-addendum": "เพิ่มบันทึกแนบท้าย ›", "prepare-contract": "จัดทำร่างสัญญา ›" };

export function ContractSection({ data, contractTemplate, isExecutive = false }: { data: SummaryData; contractTemplate?: TaskData["contractTemplate"]; isExecutive?: boolean }) {
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
  const action = (name: TaskName, row?: string, isPrimary = false) => {
    const task = findTask(tasks, name, row);
    return task ? <ContractTaskAction key={`${name}:${row ?? ""}`} task={task} sale={sale} agreement={agreement} label={actionLabels[name] ?? task.label} isPrimary={isPrimary} /> : null;
  };
  const open = (doc: Document, label = "ดูสัญญาฉบับนี้") => <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/documents/${doc.id}`} prefetch={false}>{label}</Link>;
  const listed = (doc: Document) => documentTasks(doc).map(task => action(task.name, task.row));
  const scheduleCount = contract?.payload.schedule?.length ?? contract?.payload.schedule_input?.length;
  const currentLabel = sale.status === "cancelled" ? "สัญญาอ้างอิงของโครงการยกเลิก" : contract?.state === "draft"
    ? "ร่างที่กำลังจัดทำ" : contract?.state === "awaiting_signature" ? "สัญญารอลงนาม" : "สัญญาที่ลงนาม";
  const items = contract?.state === "draft" ? contractReadiness({ sale, agreement, draft: contract, template: contractTemplate, isExecutive }) : [];
  const blockers = items.filter(item => !item.isOk);
  const isReady = contract?.state === "draft" && !!contractTemplate && !blockers.length;
  const fixes = blockers.flatMap(item => item.fix ? [item.fix] : []).filter((fix, index, all) => all.findIndex(other => other.href === fix.href) === index);
  const state = contract?.state;
  const steps: ContractStep[] = [
    { title: "เตรียมสัญญาสำหรับลงนาม", state: contract ? "done" : "now", actions: !contract && action("prepare-contract", undefined, true),
      detail: contract ? "สร้างร่างแล้ว" : accepted.length ? "สร้างร่างจากใบเสนอราคาที่ลูกค้ายอมรับ · ข้อมูลลูกค้าและราคาส่งต่อให้เอง" : "สร้างร่างจากใบเสนอราคาที่ลูกค้ายอมรับ",
      blocker: !contract && !accepted.length && sale.status !== "cancelled"
        ? { label: "ยังเริ่มสัญญาไม่ได้:", text: "ต้องมีใบเสนอราคาที่ระบุราคาและลูกค้ายอมรับก่อน", fixes: [{ label: "ไปที่ใบเสนอราคา ›", href: `/sales/${sale.id}?tab=quotation` }] } : undefined },
    { title: "แก้ร่างสัญญา", state: !contract ? "todo" : state === "draft" && !isReady ? "now" : "done",
      detail: state === "draft" ? "กรอกคู่สัญญา ข้อเพิ่มเติม และตารางงวด" : contract ? "บันทึกร่างแล้ว" : "กรอกคู่สัญญา ข้อเพิ่มเติม และตารางงวด",
      actions: state === "draft" && action("edit-contract", contract?.id, !isReady) },
    { title: "ล็อกสัญญาเพื่อเซ็น", state: state === "draft" ? isReady ? "now" : "todo" : contract ? "done" : "todo",
      detail: state === "awaiting_signature" || state === "signed" ? `เลขที่ ${contract?.number ?? "—"}` : "ระบบออกเลขสัญญาและตรึงเนื้อหา · ตรวจความพร้อมก่อนออกเลข",
      actions: state === "draft" ? action("lock-contract", contract?.id, isReady) : state === "awaiting_signature" ? action("unlock-contract", contract?.id) : undefined,
      blocker: blockers.length ? { label: "ยังล็อกไม่ได้:", text: blockers.map(item => item.detail).join(" · "), fixes } : undefined },
    { title: "บันทึกลงนามสัญญา", state: state === "awaiting_signature" ? "now" : state === "signed" ? "done" : "todo",
      detail: state === "signed" ? `ลงนามแล้ว${scheduleCount ? ` · ${scheduleCount} งวดขึ้นที่ขั้นรับชำระ` : ""}` : "พิมพ์ให้ลงนาม แล้วแนบไฟล์ที่เซ็น · งวดขึ้นที่ขั้นรับชำระ",
      actions: state === "awaiting_signature" ? action("sign-contract", contract?.id, true) : state === "signed" ? <>
        <Link className={buttonVariants({ size: "auto" })} href={`/sales/${sale.id}?tab=money#schedule`} prefetch={false}>{sale.status === "cancelled" ? "ดูยอดและประวัติรับเงิน" : "ไปการเงิน · งวดสัญญา"}</Link>
        {action("contract-addendum", contract?.id)}</> : undefined },
  ];
  return <section className={ws.section} aria-labelledby="contract-section-title">
    <WorkspaceHeading caseId={sale.id} title="สัญญาและเอกสารแนบท้าย" titleId="contract-section-title"
      description={contract ? `${currentLabel} · ${stateLabel(contract)}` : "ยังไม่มีสัญญาที่ใช้งานอยู่"} />
    {sale.status === "cancelled" && <p className={noticeClass}>โครงการยกเลิกแล้ว เอกสารเดิมยังเปิดดูเพื่ออ้างอิงได้</p>}
    <article className={`${ws.card} ${ws.current}`} aria-labelledby="current-contract-title">
      {contract ? <>
        <div className={ws.rowHeading}><div><p className={ws.eyebrow}>{currentLabel} · ฉบับที่ {contract.revision}</p>
          <h3 id="current-contract-title">{contract.number ?? "ร่างสัญญา · ยังไม่ออกเลข"}</h3></div>
          <ContractState doc={contract} /></div>
        <dl className={ws.facts}>
          <div><dt>มูลค่าตามสัญญา</dt><dd className={ws.amount}>{money(contract.payload.total_cents)}</dd></div>
          <div><dt>เครดิตค่าออกแบบตามฉบับนี้</dt><dd>{money(contract.payload.credit_cents)}</dd></div>
          <div><dt>ตารางงวดตามฉบับนี้</dt><dd>{scheduleCount == null ? "ยังไม่ระบุ" : `${scheduleCount} งวด`}</dd></div>
          <div><dt>ใบเสนอราคาอ้างอิง</dt><dd>{reference ? <Link href={`/sales/documents/${reference.id}`} prefetch={false}>{reference.number ?? "ใบเสนอราคา"} · ฉบับที่ {reference.revision}</Link> : "ยังไม่ระบุ"}</dd></div>
        </dl>
        <div className={ws.actions}>{open(contract)}</div>
      </> : <>
        <h3 id="current-contract-title">ยังไม่มีสัญญาที่ใช้งานอยู่</h3>
        <p>{sale.status === "cancelled" ? "ดูสัญญาฉบับเดิมและเอกสารยกเลิกได้จากประวัติด้านล่าง" : accepted.length
          ? "เริ่มร่างจากใบเสนอราคาที่ระบุราคาและลูกค้ายอมรับแล้ว ข้อมูลลูกค้า สถานที่และราคาจะส่งต่อไปยังร่าง"
          : "ต้องมีใบเสนอราคาที่ระบุราคาและลูกค้ายอมรับก่อนจัดทำสัญญา"}</p>
        {accepted.length > 0 && <><p className={ws.note}>ใบเสนอราคาที่ใช้เริ่มร่างได้ · เลือกฉบับอ้างอิงอีกครั้งในหน้าจัดทำร่าง</p>
          <ul className={ws.rows}>{accepted.map(doc => <li key={doc.id} className={ws.rowHeading}><div>
            <strong>{doc.number ?? "ใบเสนอราคา"} · ฉบับที่ {doc.revision}</strong><p>มูลค่าตามใบเสนอราคา {money(doc.payload.total_cents)}</p>
          </div>{open(doc, "ดูใบเสนอราคา")}</li>)}</ul></>}
        <div className={ws.actions}><Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/${sale.id}?tab=quotation`} prefetch={false}>ดูใบเสนอราคา</Link></div>
      </>}
      <div className={ws.next}>
        <ContractSteps steps={steps} />
        {state === "awaiting_signature" && findTask(tasks, "unlock-contract", contract?.id)
          && <p className={ws.note}>การกลับไปแก้ร่างจะเก็บเลขฉบับนี้เป็นเอกสารยกเลิก และออกเลขใหม่เมื่อล็อกร่างอีกครั้ง</p>}
        {state === "draft" && <p className={ws.note}>หน้าตรวจความพร้อมจะตรวจข้อมูลที่จำเป็นและข้อความบริษัทอีกครั้ง เครดิตจะตรวจจากเงินที่ยืนยันแล้ว ณ ตอนออกเลข</p>}
        {state === "signed" && <p className={ws.note}>เพิ่มข้อความหลังลงนามใช้บันทึกแนบท้าย · ติดตามตรวจรับงาน ออกบิลและรับชำระในหน้าการเงิน</p>}
        {contract && state !== "signed" && !documentTasks(contract).length && <p className={ws.note}>รอผู้มีสิทธิ์ดำเนินการตามสถานะสัญญา คุณยังเปิดอ่านเอกสารได้</p>}
        {!contract && accepted.length > 0 && sale.status !== "cancelled" && !findTask(tasks, "prepare-contract", undefined)
          && <p className={ws.note}>รอผู้มีสิทธิ์จัดทำร่างสัญญา</p>}
      </div>
    </article>
    {otherIssuedContracts.map(doc => <article key={doc.id} className={ws.card}>
      <div className={ws.rowHeading}><div><p className={ws.eyebrow}>สัญญาที่ออกเลขแล้วซึ่งยังไม่ยกเลิก · ฉบับที่ {doc.revision}</p>
        <h3>{doc.number ?? "สัญญา"}</h3></div><ContractState doc={doc} /></div>
      <p>มูลค่าตามสัญญา {money(doc.payload.total_cents)} · แสดงแยกจากฉบับที่กำลังดำเนินการด้านบน</p>
      <div className={ws.actions}>{open(doc)}{listed(doc)}</div>
    </article>)}
    {annexes.length > 0 && <section className={ws.card}><h3>เอกสารแนบท้ายและข้อตกลงที่ใช้งาน ({annexes.length})</h3>
      <ul className={ws.rows}>{annexes.map(doc => <li key={doc.id} className={ws.rowHeading}><div>
        <strong>{doc.payload.text_addendum ? "เอกสารแนบท้าย" : "ข้อตกลงแก้ไขสัญญา"} · {doc.number ?? "ยังไม่ออกเลข"}</strong>
        {doc.payload.contract_number && <p className={ws.note}>อ้างอิงสัญญา {doc.payload.contract_number}</p>}</div>{open(doc, "ดูเอกสาร")}</li>)}</ul>
    </section>}
    {history.length > 0 && <details className={ws.history} open={historyActions > 0}>
      <summary>ประวัติสัญญาและฉบับยกเลิก · {history.length} ฉบับ{historyActions > 0 && ` · มีงานที่ทำได้ ${historyActions} รายการ`}</summary>
      <ul>{history.map(doc => <li key={doc.id}><div><strong>{doc.number ?? "ร่างสัญญา · ยังไม่ออกเลข"} · ฉบับที่ {doc.revision}</strong>
        <p>{stateLabel(doc)} · {money(doc.payload.total_cents)}</p></div><div className={ws.actions}>{open(doc, "ดูเอกสาร")}{listed(doc)}</div></li>)}</ul>
    </details>}
  </section>;
}
