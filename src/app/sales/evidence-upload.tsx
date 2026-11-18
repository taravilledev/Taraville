"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/config";
import styles from "./sales.module.css";
import local from "./evidence-upload.module.css";
import { noticeClass } from "@/components/notice";

const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export function EvidenceUpload({ caseId, category = "payment", className, title = "หลักฐานการยอมรับ" }: {
  caseId: string; category?: "payment" | "agreement" | "refund" | "acceptance"; className?: string; title?: string;
}) {
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
  const picker = <label>{isGrouped ? "1. เลือกไฟล์หลักฐาน" : "หลักฐาน (PDF / รูปภาพ ไม่เกิน 10 MB)"}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={isPending}
      onChange={event => { setFile(event.target.files?.[0] ?? null); setPath(""); setError(""); }} /></label>;
  const uploadButton = <button type="button" className={isGrouped ? local.upload : styles.link} onClick={upload} disabled={isPending || !file || !!path}>
    {isPending ? "กำลังอัปโหลด…" : path ? "อัปโหลดสำเร็จแล้ว" : isGrouped ? "2. อัปโหลดไฟล์ที่เลือก" : "อัปโหลดหลักฐาน"}</button>;
  return <div className={`${styles.field} ${className ?? ""}`}>
    <input type="hidden" name="proof_path" value={path} />
    {isGrouped ? <>
      <div className={local.heading}><strong>{title}</strong><small>PDF / รูปภาพ · ไม่เกิน 10 MB</small></div>
      <div className={local.steps}>
        <div className={local.selection}>{picker}
          <p className={local.selectionHint}>{path ? "เลือกไฟล์ใหม่จะต้องอัปโหลดใหม่อีกครั้ง" : isPending ? "รอให้อัปโหลดเสร็จก่อนบันทึกรายการ" : "การเลือกไฟล์ยังไม่ส่งข้อมูล ต้องกดอัปโหลดในขั้นที่ 2"}</p>
          {file && !path && !isPending && <p className={local.waiting} role="status">เลือก {file.name} แล้ว · ยังไม่ได้อัปโหลด</p>}
        </div>
        <div className={local.transfer}>{path ? <div className={local.success} role="status"><strong>✓ อัปโหลดสำเร็จ</strong>
          <span className={local.fileName}>{file?.name}</span><small>พร้อมบันทึกรายการ</small></div> : uploadButton}</div>
      </div>
    </> : <>{picker}
      {file && !path && !isPending && <small className={styles.muted}>ยังไม่ได้อัปโหลด · กด “อัปโหลดหลักฐาน” เพื่อส่งไฟล์ {file.name}</small>}
      {uploadButton}
      {path && <small className={styles.muted} role="status">อัปโหลดสำเร็จ · พร้อมบันทึกรายการ</small>}
    </>}
    {error && <p role="alert" className={noticeClass}>{error}</p>}
  </div>;
}
