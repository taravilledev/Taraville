import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { leadDetail } from "@/lib/walkin/queries";
import { AppShell } from "@/app/walkin/app-shell";
import { LeadForm } from "@/app/walkin/lead-form";
import { surveyChoice } from "@/lib/walkin/privacy";

export const metadata = { title: "แก้ไขผู้สนใจ · Taraville Group", robots: { index: false, follow: false } };
export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p>กำลังโหลดแบบฟอร์ม…</p>}><Edit params={params} /></Suspense>;
}
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { lead, staff, events } = await leadDetail((await params).id);
  return <AppShell staff={staff}><h1>แก้ไขข้อมูลผู้สนใจ</h1><p>แบรนด์: {lead.brand === "TARAVILLE" ? "Taraville" : "บ้านคุณภาพ"} · เปลี่ยนแบรนด์ไม่ได้</p>
    <a href={`/leads/${lead.id}`}>กลับไปดูรายละเอียดล่าสุด</a>
    <LeadForm brand={lead.brand} staff={staff} owners={[]} lead={lead} choice={surveyChoice(events)} requestId={randomUUID()} />
  </AppShell>;
}
