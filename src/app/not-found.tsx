import Link from "next/link";
import styles from "./walkin/walkin.module.css";

export const metadata = { title: "ไม่พบหน้านี้ · Taraville Group", robots: { index: false, follow: false } };
export default function NotFound() {
  return <div className={styles.shell} lang="th"><main className={styles.main}><section className={styles.card}>
    <h1>ไม่พบหน้านี้</h1>
    <p>รายการอาจถูกลบ หรือลิงก์ไม่ถูกต้อง</p>
    <div className={styles.actions}>
      <Link className={styles.primaryLink} href="/leads">ไปที่รายการผู้สนใจ</Link>
      <Link className={styles.secondaryLink} href="/walkin">รับลูกค้า Walk-in</Link>
    </div>
  </section></main></div>;
}
