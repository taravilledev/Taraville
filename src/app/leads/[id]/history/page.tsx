import { redirect } from "next/navigation";

// ADR 0061: the evidence history is a drawer on the Lead page; this route only keeps old links working.
export default async function EvidenceHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/leads/${encodeURIComponent((await params).id)}?drawer=history`);
}
