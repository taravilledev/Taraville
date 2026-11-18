"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { documentGroups, type LibraryDocument } from "@/lib/sales/document-library";
import { formatMoney } from "@/lib/sales/money";
import { formatDate } from "@/lib/sales/date";
import styles from "./document-library.module.css";
import shared from "../sales.module.css";
import workspace from "./workspace-section.module.css";

type Action = { label: string; href: string; documentId?: string };
export function DocumentLibrary({ documents, actions }: { documents: LibraryDocument[]; actions: Action[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState<LibraryDocument | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  const search = query.trim().toLocaleLowerCase();
  const matches = documents.filter(doc => (!group || doc.group === group) && `${doc.title} ${doc.number ?? ""} ${doc.status} ${doc.note}`.toLocaleLowerCase().includes(search));
  const renderRows = (rows: LibraryDocument[]) => <ul className={styles.list}>{rows.map(doc => <li key={doc.id} data-cancelled={doc.state === "cancelled"}>
    <div className={styles.info}><div className={styles.rowHeading}><strong>{doc.number ?? "ยังไม่ออกเลข"}</strong><span className={styles.badge}>{doc.status}</span></div>
      <p>{doc.title}{doc.revision != null ? ` · ฉบับ ${doc.revision}` : ""} · {doc.date ? formatDate(doc.date) : "ยังไม่มีวันที่"}</p>
      {doc.note && <p className={styles.binding}>{doc.note}</p>}
      <p className={styles.amount}>{doc.amount == null ? "ยังไม่ระบุยอด" : `${formatMoney(doc.amount)} บาท`}</p>
      {actions.some(action => action.documentId === doc.id) && <div className={styles.actions}>{actions.filter(action => action.documentId === doc.id).map(action =>
        <Link key={action.href} href={action.href} prefetch={false}>{action.label}</Link>)}</div>}
    </div>
    <button type="button" className={shared.link} aria-haspopup="dialog" aria-label={`เปิดอ่าน ${doc.title} ${doc.number ?? "ร่าง"} ฉบับ ${doc.revision ?? ""}`} onClick={() => setSelected(doc)}>เปิดอ่าน</button>
  </li>)}</ul>;
  return <section className={styles.library} id="contract" aria-labelledby="document-library-title">
    <div className={workspace.header}><div><h2 id="document-library-title">เอกสารทั้งหมด</h2><p>ค้นหาและเปิดอ่านฉบับที่ใช้อยู่ พร้อมประวัติฉบับก่อนและฉบับยกเลิก</p></div>
      <div className={styles.actions}>{actions.filter(action => !action.documentId).map(action => <Link className={shared.link} key={action.href} href={action.href} prefetch={false}>{action.label}</Link>)}</div></div>
    <div className={styles.filters}>
      <label className={shared.field}>ค้นหาเอกสาร<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เลขที่ ประเภท หรือสถานะเอกสาร" /></label>
      <label className={shared.field}>ประเภทเอกสาร<select value={group} onChange={event => setGroup(event.target.value)}><option value="">ทุกประเภท</option>
        {Object.entries(documentGroups).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <p role="status">พบ {matches.length} จาก {documents.length} เอกสาร</p>
    {!matches.length && <div className={styles.empty}>{documents.length ? "ไม่พบเอกสารที่ตรงกับเงื่อนไข ลองเปลี่ยนคำค้นหาหรือประเภท" : "ยังไม่มีเอกสารในโครงการนี้"}</div>}
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
        <button type="button" className={shared.link} onClick={() => dialog.current?.close()}>ปิดเอกสาร</button></header>
        <p className={styles.previewHint}>พิมพ์หรือบันทึก PDF ได้จากปุ่มในเอกสาร · <a href={`/sales/documents/${selected.id}`} target="_blank" rel="noopener noreferrer">เปิดหน้าเต็มในแท็บใหม่</a></p>
        <iframe key={selected.id} title={`เนื้อหา ${selected.title} ${selected.number ?? "ร่าง"}`} src={`/sales/documents/${selected.id}?preview=1`} className={styles.frame} />
      </>}
    </dialog>
  </section>;
}
