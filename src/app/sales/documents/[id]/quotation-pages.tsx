import Image from "next/image";
import type { z } from "zod";
import type { agreementPayloadSchema } from "@/lib/sales/agreement-models";
import { QuotationContent } from "./quotation-content";
import styles from "./document.module.css";

export function QuotationPages({ payload, date, number, issuerName, notice }: {
  payload: z.infer<typeof agreementPayloadSchema>; date: string; number?: string | null; issuerName?: string; notice?: string;
}) {
  const paper = payload.paper;
  const parts = (payload.spec_rows?.length ?? 0) > 8 ? ["first", "continuation", "conditions"] as const : ["first", "conditions"] as const;
  const displayDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${date}T00:00:00+07:00`));
  return <div className={styles.quotePages}>{parts.map((part, index) => <article key={part} className={`${styles.paper} ${styles.quotation} ${styles.quoteSheet}`} aria-label={`ใบเสนอราคา หน้า ${index + 1}`}>
    {notice && <p className={styles.quoteNotice}>{notice}</p>}
    <header className={styles.quoteLetterhead}>
      <Image src="/brand/baan-kunapap-logo.jpg" alt="บ้านคุณภาพ" width={80} height={61} />
      {issuerName && <strong>{issuerName}</strong>}
    </header>
    <div className={styles.quoteIdentity}><h2>ใบเสนอราคา{part === "continuation" ? " (ต่อ)" : ""}</h2><p>{number ? `เลขที่ ${number} · ` : ""}วันที่ {displayDate}</p></div>
    <section className={styles.quoteCustomer} aria-label="ข้อมูลลูกค้า">
      <p><strong>ชื่อลูกค้า</strong><span>{paper?.customer_name || "—"}</span></p>
      <p><strong>ที่อยู่</strong><span>{paper?.customer_address || "—"}</span></p>
      <p><strong>เบอร์โทร</strong><span>{paper?.customer_phone || "—"}</span></p>
      <p><strong>ฝ่ายขาย</strong><span>{paper?.salesperson || "—"}</span></p>
      {paper?.site_address && <p><strong>สถานที่ก่อสร้าง</strong><span>{paper.site_address}</span></p>}
    </section>
    <QuotationContent payload={payload} date={date} part={part} />
    <footer className={styles.quotePageNumber}>หน้า {index + 1} / {parts.length}</footer>
  </article>)}</div>;
}
