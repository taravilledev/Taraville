import { Suspense } from "react";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function SalesDashboardRedirect(props: Props) {
  return <Suspense><RedirectToDashboard {...props} /></Suspense>;
}

async function RedirectToDashboard({ searchParams }: Props) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of typeof value === "string" ? [value] : value ?? []) query.append(key, entry);
  }
  return redirect(`/dashboard${query.size ? `?${query}` : ""}`);
}
