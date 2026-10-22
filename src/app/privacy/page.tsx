import { Suspense } from "react";
import Image from "next/image";
import { COMPANIES } from "@/lib/walkin/companies";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { VersionedNotice } from "@/app/walkin/versioned-notice";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "ประกาศความเป็นส่วนตัว · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<{ brand?: string | string[] }> };
export default function PrivacyPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Notice {...props} /></Suspense>;
}
async function Notice({ searchParams }: Props) {
  const brand = (await searchParams).brand === "TARAVILLE" ? "TARAVILLE" : "BAAN_KUNAPAP";
  const company = COMPANIES[brand];
  return <AppShell><article className={`${styles.card} ${styles.noticeArticle}`}>
    <h1>ประกาศความเป็นส่วนตัว</h1>
    <p className={styles.hint}>การเปิดอ่านหน้านี้ไม่ถือเป็นการให้ความยินยอม แบบสอบถามเพิ่มเติมมีตัวเลือกแยกจากคำขอติดต่อกลับ</p>
    <div className={styles.companyIdentity}>
      <Image src={company.logo} alt={`โลโก้ ${company.name}`} width={108} height={72} className={styles.companyLogo} />
      <div><h2>{company.brandName}</h2><p>{company.name}</p></div>
    </div>
    <VersionedNotice brand={brand} />
    <a className={styles.noticeLink} href={`/walkin?brand=${brand}`}>ไปหน้าแบบฟอร์ม {company.brandName}</a>
  </article></AppShell>;
}
