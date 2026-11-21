import Link from "next/link";
import { lockContract } from "../agreement-actions";
import { AgreementContent } from "../documents/[id]/agreement-content";
import { contractReadiness } from "./contract-readiness";
import * as styles from "./contract-section-styles";
import * as ws from "./workspace-styles";
import { TaskHeader } from "./tasks/task-header";
import { idOf, type TaskData } from "./tasks/task-data";
import { ActionForm } from "@/app/walkin/action-form";
import { checkRowClass } from "@/components/check-row";
import { buttonVariants } from "@/components/ui/button";

/** Lock page: readiness checklist, the draft as it will print, and the confirm. The confirm is disabled while any blocker remains; the server rejects the same cases. */
export function LockContractTask({ sale, agreement, row, contractTemplate, isExecutive = false }: TaskData) {
  const draft = agreement?.documents.find(doc => doc.id === row && doc.state === "draft");
  if (!agreement || !draft) return null;
  const items = contractReadiness({ sale, agreement, draft, template: contractTemplate, isExecutive });
  const blockers = items.filter(item => !item.isOk);
  const isReady = !!contractTemplate && !blockers.length;
  const editHref = `/sales/${sale.id}?task=edit-contract&row=${draft.id}`;
  return <div className="grid min-w-0 gap-4">
    <TaskHeader sale={sale} title="ล็อกสัญญาเพื่อเซ็น" backTab="contract" backLabel={`กลับขั้นสัญญา · ${sale.code} · ${sale.customer_name}`} hasContext={false}
      phase="สัญญา · ตรวจความพร้อมก่อนออกเลข" />
    <section className={ws.card} aria-labelledby="lock-readiness">
      <div><h2 id="lock-readiness" className="text-lg">ความพร้อมก่อนออกเลข</h2>
        <p className={ws.note}>ล็อกแล้วระบบออกเลขสัญญาและตรึงเนื้อหาสำหรับพิมพ์ให้ลงนาม ยอดเครดิตจะคำนวณจากเงินที่รับจริง ณ ตอนล็อก</p></div>
      <ul className={styles.checklist}>{items.map(item => <li key={item.id} className={styles.checkItem} data-ok={item.isOk}>
        <span className={styles.badge} data-state={item.isOk ? "done" : "blocked"} aria-hidden="true">{item.isOk ? "✓" : "!"}</span>
        <div className="grid min-w-0 flex-1 gap-1"><strong>{item.title}</strong><small>{item.detail}</small>
          {item.fix && <Link className="w-fit text-sm font-semibold text-primary underline" href={item.fix.href} prefetch={false}>{item.fix.label}</Link>}</div>
      </li>)}</ul>
    </section>
    <section className={ws.card} aria-labelledby="lock-preview">
      <div><h2 id="lock-preview" className="text-lg">ตัวอย่างสัญญา</h2><p className={ws.note}>ตรวจเนื้อหาก่อนออกเลข เอกสารจริงพิมพ์จากหน้าสัญญาหลังล็อก</p></div>
      <div className={styles.preview}><AgreementContent payload={draft.payload} /></div>
    </section>
    {isReady ? <ActionForm action={lockContract.bind(null, { ...idOf(sale), documentId: draft.id, documentVersion: draft.version })} label="ล็อกและออกเลขสัญญา"
      secondaryAction={{ label: "กลับไปแก้ร่าง", href: editHref }}>
      <label className={checkRowClass}><input type="checkbox" name="confirmed" required />ตรวจข้อมูลและพร้อมพิมพ์ให้ลงนาม</label>
    </ActionForm> : <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled className={buttonVariants({ size: "auto" })}>ล็อกและออกเลขสัญญา</button>
      <Link className={buttonVariants({ variant: "outline", size: "auto" })} href={editHref} prefetch={false}>กลับไปแก้ร่าง</Link>
      <p className={`${ws.note} basis-full`} role="status">ยังล็อกไม่ได้: {blockers.length ? blockers.map(item => item.title).join(" · ") : "ยังโหลดข้อความสัญญาของบริษัทไม่ได้"}</p>
    </div>}
  </div>;
}
