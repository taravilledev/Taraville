import { shellClass, shellFooterClass } from "@/components/app-shell-styles";
import { skeletonClass, skeletonBlockClass, skeletonTitleClass, skeletonCardClass } from "@/components/page-skeleton-styles";
import type { ReactNode } from "react";
import Image from "next/image";
import { COMPANIES } from "@/lib/walkin/companies";
import { formCardClass } from "@/components/form-card";
import { cn } from "@/lib/utils";

const BRAND_CAPTIONS = [["TARAVILLE", "ธาราวิล · บ้านจัดสรร"], ["BAAN_KUNAPAP", "บ้านคุณภาพ · รับสร้างบ้าน"]] as const;
const styles = {
  main: "mx-auto grid w-[min(100%-32px,460px)] flex-1 place-items-center py-8",
  card: cn(formCardClass, "m-0 w-full [&>header+h1]:text-lg [&_button[type=submit]]:w-full [&_ol]:list-decimal [&_ol]:pl-[1.5em]"),
  brand: "mb-6 border-b pb-6 text-center",
  badge: "m-0 mb-3 inline-block rounded-full bg-accent px-3 py-0.5 text-xs/[1.6] font-bold text-primary [font-family:var(--font-utility)]",
  group: "m-0 text-title/[1.3] font-extrabold [font-family:var(--font-utility)]",
  tagline: "mx-0 mt-1 mb-6 text-sm text-muted-foreground",
  logos: "m-0 grid list-none grid-cols-2 gap-3 p-0 [&_li]:flex [&_li]:flex-col [&_li]:gap-2 [&_li]:text-xs [&_li]:text-muted-foreground",
  logo: "relative aspect-[2/1] overflow-hidden rounded-sm border bg-card [&_img]:object-cover",
};

// Signed-out pages carry the group identity themselves, so they skip the AppShell header.
export function AuthShell({ children }: { children: ReactNode }) {
  return <div data-slot="app-shell" className={`${shellClass} dense`} lang="th">
    <main className={styles.main}>
      <section className={styles.card}>
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
