"use client";

import { useRef, type ReactNode } from "react";
import styles from "@/app/walkin/walkin.module.css";

export function AmountGuideDialog({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={styles.link} aria-haspopup="dialog" aria-controls="summary-amount-guide"
      onClick={() => dialog.current?.showModal()}>แต่ละยอดหมายถึงอะไร</button>
    <dialog id="summary-amount-guide" ref={dialog} className={styles.dialog} aria-labelledby="summary-amount-guide-title">
      <div className={styles.dialogBar}>
        <h2 id="summary-amount-guide-title">แต่ละยอดหมายถึงอะไร</h2>
        <button type="button" className={styles.link} onClick={() => dialog.current?.close()}>ปิด</button>
      </div>
      <div className={styles.dialogBody}>{children}</div>
    </dialog>
  </>;
}
