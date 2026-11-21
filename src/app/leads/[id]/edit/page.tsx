import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { leadDetail } from "@/lib/walkin/queries";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { FormHeader } from "@/app/walkin/form-header";
import { LeadForm } from "@/app/walkin/lead-form";
import { surveyChoice } from "@/lib/walkin/privacy";
import { ForbiddenNotice } from "@/components/forbidden-notice";

export const metadata = { title: "แก้ไขผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<PageSkeleton />}><Edit params={params} /></Suspense>;
}
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { lead, staff, events, supabase } = await leadDetail((await params).id);
  if (staff.role !== "executive" && lead.owner_id !== staff.id) {
    const owner = await supabase.from("staff").select("full_name").eq("id", lead.owner_id).maybeSingle();
    if (owner.error) throw new Error("โหลดผู้ดูแลไม่ได้ กรุณาลองใหม่");
    return <AppShell staff={staff}>
      <ForbiddenNotice need={`แก้ไขได้เฉพาะผู้ดูแล Lead นี้ (${owner.data?.full_name ?? "ผู้ดูแลเดิม"}) และผู้บริหาร`}
        ask="ขอให้ผู้บริหารเปลี่ยนผู้ดูแล" backHref={`/leads/${lead.id}`} backLabel="กลับหน้า Lead" />
    </AppShell>;
  }
  return <AppShell staff={staff}>
    <FormHeader
      brand={lead.brand}
      title="แก้ไขข้อมูล"
      action={
        <a className="inline-flex min-h-(--tap-min) items-center text-primary underline-offset-4" href={`/leads/${lead.id}`}>
          ← กลับไปรายละเอียด
        </a>
      }
    />
    <LeadForm brand={lead.brand} staff={staff} owners={[]} lead={lead} choice={surveyChoice(events)} requestId={randomUUID()} />
  </AppShell>;
}
