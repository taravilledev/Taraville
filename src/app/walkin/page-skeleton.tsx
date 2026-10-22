import type { Staff } from "@/lib/walkin/models";
import { AppShell } from "./app-shell";
import styles from "./walkin.module.css";

export function PageSkeleton({ staff }: { staff?: Staff }) {
  return <AppShell staff={staff}>
    <div className={styles.skeleton} role="status">
      <span className={styles.srOnly}>กำลังโหลด…</span>
      <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeletonBlock} ${styles.skeletonCard}`} />
      <div className={`${styles.skeletonBlock} ${styles.skeletonCard}`} />
    </div>
  </AppShell>;
}
