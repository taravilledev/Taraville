import type { ReactNode } from "react";
import type { Staff } from "@/lib/walkin/models";
import { AccountMenu } from "./account-menu";
import { NavTabs } from "./nav-tabs";
import styles from "./walkin.module.css";

export function AppShell({ children, staff }: { children: ReactNode; staff?: Staff }) {
  return <div className={styles.shell} lang="th">
    <header className={styles.header}>
      <a href="/walkin" className={styles.wordmark}>TARAVILLE <span className={styles.wordmarkLight}>GROUP</span></a>
      {staff && <NavTabs />}
      {staff && <AccountMenu staff={staff} />}
    </header>
    <main className={styles.main}>{children}</main>
  </div>;
}
