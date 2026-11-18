import { documentLibrary } from "@/lib/sales/document-library";
import type { SummaryData } from "./summary-sections";
import { DocumentLibrary } from "./document-library";

export function BkpDocuments({ data }: { data: SummaryData }) {
  const { sale, finance, agreement } = data;
  if (!finance || !agreement) return null;
  return <DocumentLibrary documents={documentLibrary(finance, agreement)} actions={[
    { label: "ภาพรวมโครงการ →", href: `/sales/${sale.id}?tab=overview` },
  ]} />;
}
