import { Suspense } from "react";
import Link from "next/link";
import { leadDetail } from "@/lib/walkin/queries";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { AppShell } from "@/app/walkin/app-shell";
import { EvidenceHistory } from "@/app/walkin/privacy-controls";

export const metadata = { title: "ประวัติหลักฐาน · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };
export default function EvidenceHistoryPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><History {...props} /></Suspense>;
}
async function History({ params }: Props) {
  const { id } = await params;
  const { lead, staff, events } = await leadDetail(id);
  return <AppShell staff={staff}>
    <p><Link href={`/leads/${lead.id}`} prefetch={false}>← กลับหน้าผู้สนใจ</Link></p>
    <h1>ประวัติหลักฐาน {lead.first_name} {lead.last_name}</h1>
    <EvidenceHistory events={events} />
  </AppShell>;
}
