import type { ReactNode } from "react";
import Image from "next/image";
import { COMPANIES } from "@/lib/walkin/companies";
import walkin from "@/app/walkin/walkin.module.css";
import styles from "./auth.module.css";

const BRAND_CAPTIONS = [["TARAVILLE", "ธาราวิล · บ้านจัดสรร"], ["BAAN_KUNAPAP", "บ้านคุณภาพ · รับสร้างบ้าน"]] as const;

// Signed-out pages carry the group identity themselves, so they skip the AppShell header.
export function AuthShell({ children }: { children: ReactNode }) {
  return <div className={`${walkin.shell} dense`} lang="th">
    <main className={styles.main}>
      <section className={`${walkin.card} ${styles.card}`}>
        <header className={styles.brand}>
          <p className={styles.badge}>สำหรับพนักงานเท่านั้น</p>
          <p className={styles.group}>Taraville Group</p>
          <p className={styles.tagline}>ระบบงานขายและติดตามโครงการ</p>
          <ul className={styles.logos}>
            {BRAND_CAPTIONS.map(([brand, caption]) => <li key={brand}>
              <span className={styles.logo}><Image src={COMPANIES[brand].logo} alt={COMPANIES[brand].name} fill sizes="200px" priority
                style={{ objectPosition: COMPANIES[brand].logoFocus }} /></span>
              {caption}
            </li>)}
          </ul>
        </header>
        {children}
      </section>
    </main>
    <footer className={walkin.siteFooter}>Taraville Group · ธาราวิล · บ้านคุณภาพ © 2026</footer>
  </div>;
}

export function AuthSkeleton() {
  return <AuthShell><div className={walkin.skeleton} role="status">
    <span className={walkin.srOnly}>กำลังโหลด…</span>
    <div className={`${walkin.skeletonBlock} ${walkin.skeletonTitle}`} />
    <div className={`${walkin.skeletonBlock} ${walkin.skeletonCard}`} />
  </div></AuthShell>;
}
