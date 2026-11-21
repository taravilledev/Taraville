"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { documentGroups, type LibraryDocument } from "@/lib/sales/document-library";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import * as styles from "./document-library-styles";
import * as ws from "./workspace-styles";
import { Status } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type Action = { label: string; href: string; documentId?: string };
export function DocumentLibrary({ documents, actions }: { documents: LibraryDocument[]; actions: Action[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState<LibraryDocument | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  const search = query.trim().toLocaleLowerCase();
  const matches = documents.filter(doc => (!group || doc.group === group) && `${doc.title} ${doc.number ?? ""} ${doc.status} ${doc.note}`.toLocaleLowerCase().includes(search));
  const renderRows = (rows: LibraryDocument[]) => <ul className={styles.list}>{rows.map(doc => <li key={doc.id} className="group/doc" data-cancelled={doc.state === "cancelled"}>
    <div className={styles.info}><div className={styles.rowHeading}><strong>{doc.number ?? "ยังไม่ออกเลข"}</strong><Status tone={doc.tone}>{doc.status}</Status></div>
      <p>{doc.title}{doc.revision != null ? ` · ฉบับ ${doc.revision}` : ""} · {doc.date ? formatDate(doc.date) : "ยังไม่มีวันที่"}</p>
      {doc.note && <p className={styles.binding}>{doc.note}</p>}
      <p className={styles.amount}>{doc.amount == null ? "ยังไม่ระบุยอด" : `${formatMoney(doc.amount)} บาท`}</p>
      {actions.some(action => action.documentId === doc.id) && <div className={styles.actions}>{actions.filter(action => action.documentId === doc.id).map(action =>
        <Link key={action.href} href={action.href} prefetch={false}>{action.label}</Link>)}</div>}
    </div>
    <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} aria-haspopup="dialog" aria-label={`เปิดอ่าน ${doc.title} ${doc.number ?? "ร่าง"} ฉบับ ${doc.revision ?? ""}`} onClick={() => setSelected(doc)}>เปิดอ่าน</button>
  </li>)}</ul>;
  return <section className={styles.library} id="contract" aria-labelledby="document-library-title">
    <div className={ws.header}><div><h2 id="document-library-title">เอกสารทั้งหมด</h2><p>ฉบับที่ใช้อยู่แสดงก่อน ฉบับก่อนหน้าและฉบับยกเลิกพับไว้ในแต่ละประเภท</p></div>
      <div className={styles.actions}>{actions.filter(action => !action.documentId).map(action => <Link className={buttonVariants({ variant: "outline", size: "auto" })} key={action.href} href={action.href} prefetch={false}>{action.label}</Link>)}</div></div>
    <div className={styles.filters}>
      <Field><FieldLabel htmlFor={`${id}-query`}>ค้นหาเอกสาร</FieldLabel><Input id={`${id}-query`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เลขที่ ประเภท หรือสถานะเอกสาร" /></Field>
      <Field><FieldLabel htmlFor={`${id}-group`}>ประเภทเอกสาร</FieldLabel><NativeSelect id={`${id}-group`} value={group} onChange={event => setGroup(event.target.value)}><option value="">ทุกประเภท</option>
        {Object.entries(documentGroups).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</NativeSelect></Field>
    </div>
    <p role="status">พบ {matches.length} จาก {documents.length} เอกสาร</p>
    {!matches.length && <div className={styles.empty}>{documents.length ? "ไม่พบเอกสารที่ตรงกับเงื่อนไข ลองเปลี่ยนคำค้นหาหรือประเภท"
      : <><strong className="block text-foreground">ยังไม่มีเอกสารในโครงการนี้</strong>ใบแจ้งชำระค่าออกแบบ ใบเสนอราคา สัญญา และใบเสร็จที่ออกในโครงการนี้จะรวมอยู่ที่นี่เอง ไม่ต้องอัปโหลดเพิ่ม</>}</div>}
    {Object.entries(documentGroups).map(([key, label]) => {
      const rows = matches.filter(doc => doc.group === key);
      if (!rows.length) return null;
      const current = rows.filter(doc => !doc.history); const history = rows.filter(doc => doc.history);
      return <section key={key} className={styles.group} aria-label={label}><h3>{label} <span>({rows.length})</span></h3>
        {renderRows(current)}
        {history.length > 0 && <details key={`${key}-${search}-${group}`} open={!!search || undefined} className={styles.history}>
          <summary>ประวัติฉบับก่อน / ยกเลิก ({history.length})</summary>{renderRows(history)}</details>}
      </section>;
    })}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="document-preview-title" onClose={() => setSelected(null)}>
      {selected && <><header className={styles.previewHeader}><div><h2 id="document-preview-title">{selected.title} · {selected.number ?? "ยังไม่ออกเลข"}</h2><p>{selected.status}</p></div>
        <div className={styles.previewActions}>
          <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} onClick={() => frame.current?.contentWindow?.print()}>พิมพ์ / บันทึก PDF</button>
          <Link className={cn(buttonVariants({ variant: "outline", size: "auto" }), "inline-flex min-h-11 items-center")} href={`/sales/documents/${selected.id}`} prefetch={false}>เปิดหน้าเอกสาร ›</Link>
          <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} onClick={() => dialog.current?.close()}>ปิดเอกสาร</button></div></header>
        <iframe ref={frame} key={selected.id} title={`เนื้อหา ${selected.title} ${selected.number ?? "ร่าง"}`} src={`/sales/documents/${selected.id}?preview=1`} className={styles.frame} />
      </>}
    </dialog>
  </section>;
}
