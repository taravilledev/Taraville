import { shellClass, shellFooterClass } from "@/components/app-shell-styles";
import { skeletonClass, skeletonBlockClass, skeletonTitleClass, skeletonCardClass } from "@/components/page-skeleton-styles";
import type { ReactNode } from "react";
import Image from "next/image";
import { COMPANIES } from "@/lib/walkin/companies";
import { formCardClass } from "@/components/form-card";
import styles from "./auth.module.css";

const BRAND_CAPTIONS = [["TARAVILLE", "ธาราวิล · บ้านจัดสรร"], ["BAAN_KUNAPAP", "บ้านคุณภาพ · รับสร้างบ้าน"]] as const;

// Signed-out pages carry the group identity themselves, so they skip the AppShell header.
export function AuthShell({ children }: { children: ReactNode }) {
  return <div data-slot="app-shell" className={`${shellClass} dense`} lang="th">
    <main className={styles.main}>
      <section className={`${formCardClass} ${styles.card}`}>
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
    <footer className={shellFooterClass}>Taraville Group · ธาราวิล · บ้านคุณภาพ © 2026</footer>
  </div>;
}

export function AuthSkeleton() {
  return <AuthShell><div className={skeletonClass} role="status">
    <span className="sr-only">กำลังโหลด…</span>
    <div className={`${skeletonBlockClass} ${skeletonTitleClass}`} />
    <div className={`${skeletonBlockClass} ${skeletonCardClass}`} />
  </div></AuthShell>;
}
