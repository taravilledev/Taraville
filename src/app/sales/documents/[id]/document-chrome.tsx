import Link from "next/link";
import { PrintButton } from "@/app/leads/report/print-button";
import styles from "./document.module.css";

type Back = { href: string; label: string };
type Where = { caseId: string; kind: string; isBkp: boolean; isDesignInvoice: boolean; isTextAddendum: boolean };

// Back target by document kind. Both brands have a money tab (Taraville calls it รับเงิน); only BKP has the other stage tabs.
export function backTarget({ caseId, kind, isBkp, isDesignInvoice, isTextAddendum }: Where): Back {
  const base = `/sales/${caseId}`;
  const money = isBkp ? "ขั้นรับชำระ" : "หน้ารับเงิน";
  if (kind === "receipt") return { href: `${base}?tab=money#receipts`, label: money };
  if (kind === "invoice") return isBkp && isDesignInvoice ? { href: `${base}?tab=design`, label: "ขั้นออกแบบ" } : { href: `${base}?tab=money#schedule`, label: money };
  if (!isBkp || isTextAddendum) return { href: base, label: "งาน/รายการขาย" };
  if (kind === "quotation") return { href: `${base}?tab=quotation`, label: "ขั้นใบเสนอราคา" };
  if (kind === "contract") return { href: `${base}?tab=contract`, label: "ขั้นสัญญา" };
  return { href: base, label: "งาน/รายการขาย" };
}

export function DocumentBar({ back }: { back: Back }) {
  return <nav className={styles.controls} aria-label="เอกสาร"><Link href={back.href} prefetch={false}>← กลับ{back.label}</Link><PrintButton /></nav>;
}

export type DocumentStatus = { isSynthetic: boolean; state: string; cancelReason?: string | null };

// One bar above the paper; it prints with the paper. Cancelled outranks awaiting signature, then draft, then test data.
export function DocumentStatusBar({ isSynthetic, state, cancelReason }: DocumentStatus) {
  const texts = [isSynthetic ? "ข้อมูลทดสอบ · ไม่ใช่เอกสารธุรกรรมจริง" : "",
    state === "draft" ? "ร่างสัญญา · รอตรวจและล็อกเพื่อออกเลข" : "",
    state === "awaiting_signature" ? "รอลงนาม · ยังไม่เป็นสัญญาที่ลงนามแล้ว" : "",
    state === "cancelled" ? `ยกเลิกเอกสาร${cancelReason ? ` · ${cancelReason}` : ""}` : ""].filter(Boolean);
  if (!texts.length) return null;
  const tone = state === "cancelled" ? "cancelled" : state === "awaiting_signature" ? "awaiting" : state === "draft" ? "draft" : "test";
  return <p role="status" className={styles.statusBar} data-tone={tone}>{texts.join(" · ")}</p>;
}
