"use client";

import { textActionClass } from "@/components/action-link-styles";
import { nativeDialogClass, nativeDialogHeaderClass, nativeDialogBodyClass } from "@/components/native-dialog-styles";
import { useRef } from "react";
import { DownloadIcon } from "./header-icons";
import styles from "./leads.module.css";

export function LeadExportDialog({ options }: { options: { label: string; href: string }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={styles.actionBtn} aria-haspopup="dialog" aria-controls="lead-export-dialog"
      onClick={() => dialog.current?.showModal()}><DownloadIcon />ส่งออก CSV</button>
    <dialog ref={dialog} id="lead-export-dialog" className={nativeDialogClass} aria-labelledby="lead-export-title">
      <div className={nativeDialogHeaderClass}>
        <h2 id="lead-export-title">เลือกแบรนด์สำหรับส่งออก CSV</h2>
        <button type="button" className={textActionClass} onClick={() => dialog.current?.close()}>ปิด</button>
      </div>
      <div className={`${nativeDialogBodyClass} ${styles.exportChoices}`}>
        <p>เลือกแบรนด์เพื่อดาวน์โหลดตามคำค้นและตัวกรองที่ใช้อยู่</p>
        {options.map(({ label, href }) => <a key={label} className={styles.actionBtn} href={href} download
          onClick={() => dialog.current?.close()}>{label}<DownloadIcon /></a>)}
      </div>
    </dialog>
  </>;
}
