"use client";

import { useRef, type ReactNode } from "react";
import styles from "@/app/walkin/walkin.module.css";

export function OpenProjectDialog({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={styles.primaryLink} aria-haspopup="dialog" aria-controls="open-project-dialog"
      onClick={() => dialog.current?.showModal()}>เปิดโครงการ</button>
    <dialog id="open-project-dialog" ref={dialog} className={styles.dialog} aria-labelledby="open-project-title">
      <div className={styles.dialogBar}><h2 id="open-project-title">เปิดโครงการใหม่</h2>
        <button type="button" className={styles.link} onClick={() => dialog.current?.close()}>ปิด</button></div>
      <div className={styles.dialogBody}>{children}</div>
    </dialog>
  </>;
}
