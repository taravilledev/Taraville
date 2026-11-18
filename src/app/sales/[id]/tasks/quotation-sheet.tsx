import Image from "next/image";
import type { z } from "zod";
import type { quotationInputSchema } from "@/lib/sales/agreement-inputs";
import { QuotationPages } from "../../documents/[id]/quotation-pages";
import local from "./quotation-editor.module.css";

export function QuotationBrand() {
  return <header className={local.letterhead}>
    <Image src="/brand/baan-kunapap-logo.jpg" alt="บ้านคุณภาพ" width={100} height={76} />
    <strong>บ้านคุณภาพ</strong>
  </header>;
}

export function QuotationPreview({ input }: { input: z.infer<typeof quotationInputSchema> }) {
  const paper = input.paper!;
  return <section aria-label="ตัวอย่างใบเสนอราคา"><QuotationPages
    payload={{ ...input, total_cents: input.total_cents ?? "0", price_set: input.total_cents !== null, design_fee_separate: true }} date={paper.document_date}
    notice="ตัวอย่างก่อนบันทึก · ยังไม่ออกเลขใบเสนอราคา" />
  </section>;
}
