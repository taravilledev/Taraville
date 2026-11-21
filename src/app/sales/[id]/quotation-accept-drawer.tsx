import type { AgreementDetail } from "@/lib/sales/agreement-models";
import type { SalesCase } from "@/lib/sales/models";
import { AcceptQuotationTask } from "./tasks/document-tasks";
import { Drawer } from "@/components/drawer";
import { buttonVariants } from "@/components/ui/button";

/** Accept form for one quotation revision. `?drawer=accept-<id>` opens it on load (the next-step card links here). */
export function AcceptQuotationDrawer({ sale, agreement, document, isPrimary }: {
  sale: SalesCase; agreement: AgreementDetail; document: AgreementDetail["documents"][number]; isPrimary: boolean;
}) {
  const title = `บันทึกลูกค้ายอมรับฉบับที่ ${document.revision}`;
  return <Drawer name={`accept-${document.id}`} title={title}
    trigger={<button type="button" className={buttonVariants({ variant: isPrimary ? "default" : "outline", size: "auto" })}>{title}</button>}>
    <AcceptQuotationTask sale={sale} agreement={agreement} row={document.id} key={`${sale.version}:${document.id}`} />
  </Drawer>;
}
