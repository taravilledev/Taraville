"use client";

import { useRef, type ReactNode } from "react";
import styles from "./walkin.module.css";

const DIALOG_ID = "notice-dialog";

export function NoticeLink() {
  return <button type="button" className={styles.link}
    onClick={() => (document.getElementById(DIALOG_ID) as HTMLDialogElement | null)?.showModal()}>อ่านประกาศ</button>;
}

export function NoticeDialog({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <dialog id={DIALOG_ID} ref={dialog} className={styles.dialog} aria-labelledby="notice-dialog-title"
    onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
    <div className={styles.dialogBar}><h2 id="notice-dialog-title">ประกาศความเป็นส่วนตัว</h2>
      <button type="button" className={styles.link} onClick={() => dialog.current?.close()}>ปิด</button></div>
    <div className={styles.dialogBody}>{children}</div>
  </dialog>;
}
