import Link from "next/link";
import { formatMoney } from "@/lib/sales/money";
import { findTask, taskHref } from "@/lib/sales/tasks";
import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { SummaryData } from "./summary-sections";
import * as styles from "./quotation-section-styles";
import { WorkspaceHeading } from "./workspace-heading";
import { AcceptQuotationDrawer } from "./quotation-accept-drawer";
import { Status } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";

type Document = AgreementDetail["documents"][number];
const hasPrice = (doc: Document) => doc.payload.price_set !== false && BigInt(doc.payload.total_cents ?? "0") > BigInt(0);
const status = (doc: Document) => doc.state === "accepted" ? "ลูกค้ายอมรับแล้ว" : !hasPrice(doc) ? "ยังไม่ระบุราคา" : "รอลูกค้ายอมรับ";
const amount = (doc: Document) => hasPrice(doc) ? `${formatMoney(doc.payload.total_cents!)} บาท` : "ยังไม่ระบุราคา";

export function QuotationSection({ data }: { data: SummaryData }) {
  const { sale, agreement, tasks } = data;
  if (!agreement) return null;
  const documents = agreement.documents.filter(doc => doc.kind === "quotation" && doc.state !== "cancelled")
    .sort((a, b) => b.revision - a.revision);
  const latest = documents[0];
  const accepted = documents.filter(doc => doc.state === "accepted" && hasPrice(doc));
  const acceptedOlder = accepted.filter(doc => doc.id !== latest?.id);
  const history = documents.filter(doc => doc.id !== latest?.id && !acceptedOlder.some(item => item.id === doc.id));
  const issue = findTask(tasks, "issue-quotation", undefined);
  const acceptTask = latest && findTask(tasks, "accept-quotation", latest.id);
  const historyActions = history.filter(doc => findTask(tasks, "accept-quotation", doc.id)).length;
  const hint = !latest ? "เริ่มใบเสนอราคาจากข้อมูลลูกค้าและความต้องการบ้านของโครงการนี้"
    : accepted.length ? "มีฉบับที่ลูกค้ายอมรับแล้ว ไปดูสัญญาและดำเนินงานต่อได้"
      : !hasPrice(latest) ? historyActions > 0
        ? "ฉบับล่าสุดยังไม่ระบุราคา เลือกฉบับก่อนที่มีราคาในประวัติเพื่อบันทึกลูกค้ายอมรับ หรือจัดทำฉบับใหม่พร้อมราคา"
        : "ฉบับล่าสุดยังไม่ระบุราคา ต้องจัดทำฉบับใหม่พร้อมราคาก่อนบันทึกลูกค้ายอมรับ"
        : "ตรวจใบเสนอราคาและข้อตกลงกับลูกค้า แล้วบันทึกเมื่อลูกค้ายอมรับพร้อมหลักฐาน";
  const open = (doc: Document) => <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={`/sales/documents/${doc.id}`} prefetch={false}>ดู / พิมพ์ · ฉบับที่ {doc.revision}</Link>;
  const accept = (doc: Document, isPrimary: boolean) => findTask(tasks, "accept-quotation", doc.id) &&
    <AcceptQuotationDrawer sale={sale} agreement={agreement} document={doc} isPrimary={isPrimary} />;
  return <section className={styles.section} aria-labelledby="quotations-title">
    <WorkspaceHeading caseId={sale.id} title="ใบเสนอราคา" titleId="quotations-title"
      description={`${documents.length} ฉบับ · ${accepted.length ? `ลูกค้ายอมรับแล้ว ${accepted.length} ฉบับ` : "ยังไม่มีฉบับที่ลูกค้ายอมรับ"}`} />
    {latest ? <article className={styles.latest} aria-labelledby="latest-quotation">
      <div className={styles.header}><div><p className={styles.eyebrow}>ฉบับล่าสุด · ฉบับที่ {latest.revision}</p>
        <h3 id="latest-quotation">{latest.number ?? "ใบเสนอราคา · ยังไม่มีเลขเอกสาร"}</h3></div>
        <Status tone={latest.state === "accepted" ? "success" : hasPrice(latest) ? "waiting" : "progress"}>{status(latest)}</Status></div>
      <dl className={styles.facts}>
        <div><dt>ยอดเสนอ</dt><dd className={styles.amount}>{amount(latest)}</dd></div>
        {latest.payload.house && <div><dt>แบบบ้าน</dt><dd>{latest.payload.house.model} · {latest.payload.house.usable_area} ตร.ม.</dd></div>}
        <div><dt>ค่าออกแบบ</dt><dd>แยกต่างหาก <span className="text-sm text-muted-foreground">ไม่รวมในราคานี้</span></dd></div>
        {latest.payload.paper?.document_date && <div><dt>วันที่ออก</dt><dd>{latest.payload.paper.document_date}</dd></div>}
      </dl>
      <div className={styles.next}><p>{hint}</p>
        <div className={styles.actions}>{open(latest)}
          {accept(latest, !accepted.length)}
          {issue && <Link className={!accepted.length && !acceptTask ? buttonVariants({ size: "auto" }) : buttonVariants({ variant: "outline", size: "auto" })} href={taskHref(sale.id, issue.name)} prefetch={false}>
            {!hasPrice(latest) ? "จัดทำฉบับใหม่พร้อมราคา" : "ออกฉบับแก้ไข"}</Link>}
          {accepted.length > 0 && <Link className={buttonVariants({ size: "auto" })} href={`/sales/${sale.id}?tab=contract`} prefetch={false}>ไปสัญญา →</Link>}
        </div>
        {issue && <p className="text-sm text-muted-foreground">ฉบับใหม่เริ่มจากข้อมูลฉบับล่าสุด โดยเก็บฉบับเดิมไว้</p>}
        {!issue && !acceptTask && !accepted.length && !historyActions && <p className="text-sm text-muted-foreground">ขณะนี้บัญชีนี้ไม่มีงานแก้ไขหรือยอมรับที่ทำได้ตามสิทธิ์และสถานะโครงการ</p>}
      </div>
    </article> : <div className={styles.latest}><h3>ยังไม่มีใบเสนอราคา</h3><p>{hint}</p>
      <p className="text-sm text-muted-foreground">ฉบับที่ออกแล้วจะแสดงที่นี่ ฉบับล่าสุดอยู่บนสุด · ต้องระบุราคาก่อน จึงบันทึกลูกค้ายอมรับได้ · ค่าออกแบบแยกต่างหาก ไม่รวมในใบเสนอราคา</p>
      {issue ? <div className={styles.actions}><Link className={buttonVariants({ size: "auto" })} href={taskHref(sale.id, issue.name)} prefetch={false}>จัดทำใบเสนอราคา</Link></div>
        : <p className="text-sm text-muted-foreground">รอผู้มีสิทธิ์จัดทำใบเสนอราคา</p>}</div>}
    {acceptedOlder.map(doc => <article key={doc.id} className={styles.accepted}>
      <div><h3>ฉบับที่ลูกค้ายอมรับ · ฉบับที่ {doc.revision}</h3><p>{doc.number ?? "ใบเสนอราคา"} · {amount(doc)}</p>
        <p className="text-sm text-muted-foreground">การยอมรับนี้เป็นของฉบับที่ {doc.revision} แยกจากฉบับล่าสุด</p></div>{open(doc)}
    </article>)}
    {history.length > 0 && <details className={styles.history}>
      <summary>ประวัติฉบับก่อน · {history.length} ฉบับ{historyActions > 0 && ` · บันทึกลูกค้ายอมรับได้ ${historyActions} ฉบับ`}</summary>
      <ul>{history.map(doc => {
        return <li key={doc.id}><div><h3>ฉบับที่ {doc.revision} · {doc.number ?? "ใบเสนอราคา"}</h3>
          <p>{amount(doc)} · {status(doc)}</p></div>
          <div className={styles.actions}>{open(doc)}{accept(doc, false)}</div>
        </li>;
      })}</ul>
    </details>}
  </section>;
}
