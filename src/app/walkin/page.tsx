import { formErrorClass } from "@/components/form-feedback";
import type { Metadata } from "next";
import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Image from "next/image";
import { requireStaff } from "@/lib/supabase/staff";
import { staffSchema } from "@/lib/walkin/models";
import { COMPANIES } from "@/lib/walkin/companies";
import type { Brand } from "@/lib/walkin/survey-questions";
import { AppShell } from "./app-shell";
import { PageSkeleton } from "./page-skeleton";
import { ChangeBrandLink } from "./change-brand-link";
import { FormHeader } from "./form-header";
import { NoticeLink } from "./notice-dialog";
import { LEAD_FORM_ID, LeadForm } from "./lead-form";
import { formHintClass } from "@/components/form-card";
import { walkinTitleClass } from "./walkin-form-styles";

export const metadata: Metadata = {
  title: "รับลูกค้า Walk-in · Taraville Group", robots: { index: false, follow: false },
};
const BRAND_CHOICES: { brand: Brand; summary: string }[] = [
  { brand: "BAAN_KUNAPAP", summary: "สร้างบ้านบนที่ดินของลูกค้า" },
  { brand: "TARAVILLE", summary: "บ้านพร้อมที่ดิน" },
];
type WalkinProps = { searchParams: Promise<{ brand?: string | string[] }> };
export default function WalkinPage(props: WalkinProps) {
  return <Suspense fallback={<PageSkeleton />}><WalkinContent {...props} /></Suspense>;
}
async function WalkinContent({ searchParams }: WalkinProps) {
  const { supabase, staff } = await requireStaff();
  const { brand: brandParam } = await searchParams;
  const brand: Brand | null = brandParam === "TARAVILLE" || brandParam === "BAAN_KUNAPAP" ? brandParam : null;
  if (!brand) return <AppShell staff={staff}><h1 className={walkinTitleClass}>รับลูกค้า Walk-in</h1>
    <p className={formHintClass}>เลือกแบรนด์ที่ลูกค้าสนใจก่อนเริ่มกรอก</p>
    <nav className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1" aria-label="เลือกแบรนด์">
      {BRAND_CHOICES.map(({ brand: value, summary }) => <a key={value} className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 pt-6 pb-8 text-center text-foreground no-underline active:border-primary active:bg-muted hover:border-primary hover:shadow-[var(--shadow-hover)] [&_strong]:text-lg [&_small]:text-sm [&_small]:text-muted-foreground" href={`/walkin?brand=${value}`}>
        <span className="relative mb-3 aspect-[2/1] w-full [&_img]:object-cover"><Image src={COMPANIES[value].logo} alt="" fill sizes="(min-width: 640px) 440px, 100vw" priority
          style={{ objectPosition: COMPANIES[value].logoFocus }} /></span>
        <strong>{COMPANIES[value].brandName}</strong><small>{summary}</small></a>)}
    </nav></AppShell>;
  const owners = staff.role === "executive" ? await supabase.from("staff")
    .select("id,full_name,role,is_active").eq("role", "sale").eq("is_active", true).order("full_name") : null;
  if (owners?.error) throw new Error("โหลดรายชื่อผู้ดูแลไม่ได้ กรุณาลองใหม่");
  const roster = staffSchema.array().parse(owners?.data ?? []);
  return <AppShell staff={staff}>
    <FormHeader brand={brand} title="แบบฟอร์มรับลูกค้า" action={<ChangeBrandLink formId={LEAD_FORM_ID} />}
      note={<>แจ้งประกาศก่อนกรอก · <NoticeLink /></>} />
    {staff.role === "executive" && !roster.length && <p className={formErrorClass}>ยังไม่มีบัญชีฝ่ายขายที่ใช้งานได้ กรุณาเตรียมบัญชีก่อนบันทึก</p>}
    <LeadForm key={brand} brand={brand} staff={staff} owners={roster} requestId={randomUUID()} />
  </AppShell>;
}
