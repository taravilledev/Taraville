"use client";

import styles from "./walkin/walkin.module.css";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className={styles.shell} lang="th"><main className={styles.main}><section className={styles.card}>
    <h1>เปิดหน้านี้ไม่สำเร็จ</h1>
    <p>กรุณาลองใหม่ หากยังไม่ได้ให้ติดต่อผู้ดูแล</p>
    <div className={styles.actions}>
      <button className={styles.primaryButton} onClick={reset}>ลองใหม่</button>
      <a className={styles.secondaryLink} href="/login">กลับหน้าเข้าสู่ระบบ</a>
    </div>
  </section></main></div>;
}
