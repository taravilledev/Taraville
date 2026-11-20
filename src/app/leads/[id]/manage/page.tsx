import { redirect } from "next/navigation";

// ADR 0061: status, survey choice and owner now live on the Lead page; this route only keeps old links working.
export default async function ManageLeadPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/leads/${encodeURIComponent((await params).id)}`);
}
