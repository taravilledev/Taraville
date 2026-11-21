import Link from "next/link";
import { Notice } from "@/components/notice";
import { Panel } from "@/components/panel";
import { Status, type StatusTone } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import type { Brand, Issuer } from "./issuer-data";

export function contractStatus(brand: Brand, issuer?: Issuer): { tone: StatusTone; label: string } {
  if (!issuer?.contract_text.trim()) return { tone: "inactive", label: "ยังไม่มีข้อความ" };
  if (brand !== "BAAN_KUNAPAP") return { tone: "success", label: "ใช้งานได้ · ไม่ต้องอนุมัติ" };
  return issuer.contract_text_approved ? { tone: "success", label: "อนุมัติแล้ว · ใช้กับลูกค้าจริงได้" } : { tone: "waiting", label: "ร่าง · ยังไม่อนุมัติ" };
}

export function ContractSection({ brand, brandName, issuer, editHref }: { brand: Brand; brandName: string; issuer?: Issuer; editHref: string }) {
  const status = contractStatus(brand, issuer);
  const blocksLock = brand === "BAAN_KUNAPAP" && !issuer?.contract_text_approved;
  return <Panel className="grid min-w-0 gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="grid gap-1"><h2 className="!m-0">ข้อความสัญญามาตรฐาน (ข้อ 3–14)</h2><Status tone={status.tone}>{status.label}</Status></div>
      <Link href={editHref} className={buttonVariants({ variant: "outline", size: "auto" })}>แก้ข้อความสัญญา</Link>
    </div>
    {blocksLock && <Notice><strong>ตอนนี้ล็อกสัญญาบ้านคุณภาพไม่ได้</strong> · ต้องอนุมัติข้อความก่อน · กด “แก้ข้อความสัญญา” แล้วเลือก “บันทึกและอนุมัติให้ใช้จริง”</Notice>}
    {issuer?.contract_text.trim() && <pre className="m-0 line-clamp-6 max-h-48 overflow-hidden whitespace-pre-wrap rounded-sm bg-secondary p-4 font-sans text-sm [overflow-wrap:anywhere]">{issuer.contract_text}</pre>}
    <p className="m-0 text-sm text-muted-foreground">ใช้กับสัญญาของ{brandName} · ข้อ 15 เป็นต้นไปเพิ่มในร่างสัญญาแต่ละฉบับ</p>
  </Panel>;
}
