"use client";

import { useId, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/config";
import { noticeClass } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export function EvidenceUpload({ caseId, category = "payment", className, title = "หลักฐานการยอมรับ" }: {
  caseId: string; category?: "payment" | "agreement" | "refund" | "acceptance"; className?: string; title?: string;
}) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState(""); const [error, setError] = useState(""); const [isPending, setPending] = useState(false);
  const isGrouped = !!className;
  async function upload() {
    if (!file || !extensions[file.type] || file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setError("เลือก PDF, JPG, PNG หรือ WebP ขนาดไม่เกิน 10 MB"); return;
    }
    setPending(true); setError("");
    try {
      const config = supabaseConfig(); const client = createBrowserClient(config.url, config.key);
      const nextPath = `${caseId}/${category}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const result = await client.storage.from("sales-evidence").upload(nextPath, file, { upsert: false, contentType: file.type });
      if (result.error) setError("แนบหลักฐานไม่ได้ กรุณาตรวจสอบสิทธิ์และลองใหม่"); else setPath(nextPath);
    } catch { setError("แนบหลักฐานไม่ได้ กรุณาลองใหม่"); } finally { setPending(false); }
  }
  const picker = <Field><FieldLabel htmlFor={`${id}-file`}>{isGrouped ? "1. เลือกไฟล์หลักฐาน" : "หลักฐาน (PDF / รูปภาพ ไม่เกิน 10 MB)"}</FieldLabel>
    <Input id={`${id}-file`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={isPending}
      onChange={event => { setFile(event.target.files?.[0] ?? null); setPath(""); setError(""); }} /></Field>;
  const uploadButton = <button type="button" className={isGrouped ? cn(buttonVariants({ variant: "outline" }), "border-primary font-bold text-primary") : buttonVariants({ variant: "outline", size: "auto" })} onClick={upload} disabled={isPending || !file || !!path}>
    {isPending ? "กำลังอัปโหลด…" : path ? "อัปโหลดสำเร็จแล้ว" : isGrouped ? "2. อัปโหลดไฟล์ที่เลือก" : "อัปโหลดหลักฐาน"}</button>;
  return <div className={cn("flex min-w-0 flex-col gap-2", className)}>
    <input type="hidden" name="proof_path" value={path} />
    {isGrouped ? <>
      <div className="flex flex-wrap items-baseline justify-between gap-2 [&_small]:text-muted-foreground"><strong>{title}</strong><small>PDF / รูปภาพ · ไม่เกิน 10 MB</small></div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,auto)] items-start gap-4 rounded-sm bg-accent p-4 max-[640px]:grid-cols-1">
        <div className="min-w-0">{picker}
          <p className="mt-2 mb-0 text-sm text-muted-foreground">{path ? "เลือกไฟล์ใหม่จะต้องอัปโหลดใหม่อีกครั้ง" : isPending ? "รอให้อัปโหลดเสร็จก่อนบันทึกรายการ" : "การเลือกไฟล์ยังไม่ส่งข้อมูล ต้องกดอัปโหลดในขั้นที่ 2"}</p>
          {file && !path && !isPending && <p className="mt-2 rounded-sm border border-warn-line bg-warn-tint px-3 py-2 text-sm text-warn-ink [overflow-wrap:anywhere]" role="status">เลือก {file.name} แล้ว · ยังไม่ได้อัปโหลด</p>}
        </div>
        <div className="grid content-start pt-[calc(var(--text-md)+1rem)] max-[640px]:pt-0">{path ? <div className="grid max-w-[280px] gap-1 text-success-ink [&_small]:text-muted-foreground" role="status"><strong>✓ อัปโหลดสำเร็จ</strong>
          <span className="text-sm [overflow-wrap:anywhere]">{file?.name}</span><small>พร้อมบันทึกรายการ</small></div> : uploadButton}</div>
      </div>
    </> : <>{picker}
      {file && !path && !isPending && <small className="text-sm text-muted-foreground">ยังไม่ได้อัปโหลด · กด “อัปโหลดหลักฐาน” เพื่อส่งไฟล์ {file.name}</small>}
      {uploadButton}
      {path && <small className="text-sm text-muted-foreground" role="status">อัปโหลดสำเร็จ · พร้อมบันทึกรายการ</small>}
    </>}
    {error && <p role="alert" className={noticeClass}>{error}</p>}
  </div>;
}
