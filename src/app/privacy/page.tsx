import { noticeLinkClass, secondaryActionClass } from "@/components/action-link-styles";
import { noticeArticleClass } from "@/components/privacy-notice-styles";
import { Suspense } from "react";
import Image from "next/image";
import { COMPANIES } from "@/lib/walkin/companies";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { VersionedNotice } from "@/app/walkin/versioned-notice";
import { formCardClass, formHintClass } from "@/components/form-card";
import { cn } from "@/lib/utils";

export const metadata = { title: "ประกาศความเป็นส่วนตัว · Taraville Group", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<{ brand?: string | string[] }> };
export default function PrivacyPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Notice {...props} /></Suspense>;
}
async function Notice({ searchParams }: Props) {
  const requested = (await searchParams).brand;
  if (requested !== "TARAVILLE" && requested !== "BAAN_KUNAPAP") return <BrandPicker />;
  const brand = requested;
  const company = COMPANIES[brand];
  return <AppShell><article className={`${formCardClass} ${noticeArticleClass}`}>
    <h1>ประกาศความเป็นส่วนตัว</h1>
    <p className={formHintClass}>การเปิดอ่านหน้านี้ไม่ถือเป็นการให้ความยินยอม แบบสอบถามเพิ่มเติมมีตัวเลือกแยกจากคำขอติดต่อกลับ</p>
    <div className="mb-6 flex items-center gap-4 [&_h2]:m-0 [&_h2]:mb-1 [&_h2]:text-md/[1.6] [&_h2]:font-bold [&_p]:m-0 [&_p]:text-sm [&_p]:wrap-anywhere">
      <Image src={company.logo} alt={`โลโก้ ${company.name}`} width={108} height={72} className="h-[72px] w-[108px] shrink-0 rounded-sm bg-card object-contain" />
      <div><h2>{company.brandName}</h2><p>{company.name}</p></div>
    </div>
    <VersionedNotice brand={brand} />
    <a className={noticeLinkClass} href={`/walkin?brand=${brand}`}>ไปหน้าแบบฟอร์ม {company.brandName}</a>
    <a className={`${noticeLinkClass} ml-4`} href="/privacy">เปลี่ยนแบรนด์</a>
  </article></AppShell>;
}
function BrandPicker() {
  return <AppShell><article className={`${formCardClass} ${noticeArticleClass}`}>
    <h1>ประกาศความเป็นส่วนตัว</h1>
    <p className={formHintClass}>การเปิดอ่านหน้านี้ไม่ถือเป็นการให้ความยินยอม แบบสอบถามเพิ่มเติมมีตัวเลือกแยกจากคำขอติดต่อกลับ</p>
    <p>เลือกแบรนด์ที่ต้องการอ่านประกาศ</p>
    <div className="flex flex-col gap-3">
      {(["BAAN_KUNAPAP", "TARAVILLE"] as const).map(brand => <a key={brand} className={cn(secondaryActionClass, "flex-col items-start")} href={`/privacy?brand=${brand}`}>
        <strong>{COMPANIES[brand].brandName}</strong><span className="text-xs font-normal">{COMPANIES[brand].name}</span>
      </a>)}
    </div>
  </article></AppShell>;
}
