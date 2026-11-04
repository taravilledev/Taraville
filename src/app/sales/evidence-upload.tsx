"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/config";
import styles from "./sales.module.css";

const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export function EvidenceUpload({ caseId, category = "payment" }: { caseId: string; category?: "payment" | "agreement" | "refund" | "acceptance" }) {
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState(""); const [error, setError] = useState(""); const [isPending, setPending] = useState(false);
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
  return <div className={styles.field}>
    <label>หลักฐาน (PDF / รูปภาพ ไม่เกิน 10 MB)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={isPending}
      onChange={event => { setFile(event.target.files?.[0] ?? null); setPath(""); setError(""); }} /></label>
    <input type="hidden" name="proof_path" value={path} />
    <button type="button" className={styles.link} onClick={upload} disabled={isPending || !file || !!path}>{isPending ? "กำลังแนบ…" : path ? "แนบหลักฐานแล้ว" : "แนบหลักฐาน"}</button>
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {path && <small className={styles.muted}>แนบแล้ว พร้อมบันทึกรายการ</small>}
  </div>;
}
