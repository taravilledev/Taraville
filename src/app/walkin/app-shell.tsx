import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import type { Staff } from "@/lib/walkin/models";
import { AccountMenu } from "./account-menu";
import { NavTabs } from "./nav-tabs";
import styles from "./walkin.module.css";

export function AppShell({ children, staff, wide }: { children: ReactNode; staff?: Staff; wide?: boolean }) {
  return <div className={`${styles.shell} dense`} lang="th">
    <header className={styles.header}>
      <a href="/walkin" className={styles.wordmark}>
        <span className={styles.logoMark} aria-hidden="true"><Building2 size={18} /></span>
        <span className={styles.wordmarkText}><strong>Taraville Group</strong><small>ธาราวิล · บ้านคุณภาพ</small></span>
      </a>
      {staff && <NavTabs />}
      {staff && <AccountMenu staff={staff} />}
    </header>
    <main className={wide ? `${styles.main} ${styles.mainWide}` : styles.main}>{children}</main>
    <footer className={styles.siteFooter}>Taraville Group · ธาราวิล · บ้านคุณภาพ © 2026</footer>
  </div>;
}
