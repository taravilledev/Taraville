import { Suspense } from "react";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

// ADR 0061: the evidence history is a drawer on the Lead page; this route only keeps old links working.
// Cache Components needs `params` read inside Suspense, as every other page here does.
export default function EvidenceHistoryPage(props: Props) {
  return <Suspense><ToLead {...props} /></Suspense>;
}

async function ToLead({ params }: Props) {
  redirect(`/leads/${encodeURIComponent((await params).id)}?drawer=history`);
  return null;
}
