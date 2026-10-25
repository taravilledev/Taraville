"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LeadFilters } from "@/lib/walkin/lead-list";
import { STAGE_CODES, STAGE_LABELS } from "@/lib/walkin/lead-stage";
import styles from "./leads.module.css";

type Props = { filters: LeadFilters; owners?: { id: string; full_name: string }[]; activeCount: number };

// Search and filters share one form; every change rewrites the URL so the server list re-renders in place.
export function ListControls({ filters, owners, activeCount }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  function apply() {
    if (!formRef.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(formRef.current)) if (typeof value === "string" && value) params.set(key, value);
    const [sort, dir] = (params.get("order") ?? "").split(":");
    params.delete("order");
    if (sort && sort !== "created") params.set("sort", sort);
    if (dir && dir !== "desc") params.set("dir", dir);
    const query = params.toString();
    router.replace(query ? `/leads?${query}` : "/leads", { scroll: false });
  }
  function onChange(event: ChangeEvent<HTMLFormElement>) {
    clearTimeout(timer.current);
    if (event.target.name === "q") timer.current = setTimeout(apply, 300);
    else apply();
  }
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    clearTimeout(timer.current);
    apply();
  }

  return <form ref={formRef} className={styles.controls} action="/leads" method="get" onChange={onChange} onSubmit={onSubmit}>
    {filters.brand && <input type="hidden" name="brand" value={filters.brand} />}
    {filters.closed && <input type="hidden" name="closed" value={filters.closed} />}
    <div className={styles.searchRow}>
      <label className={styles.field}>ค้นหาชื่อ เบอร์โทร หรือ LINE ID
        <input type="search" name="q" defaultValue={filters.q} maxLength={50} autoComplete="off" /></label>
      <button type="button" className={styles.filterToggle} aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
        ตัวกรอง{activeCount > 0 ? ` (${activeCount})` : ""}</button>
    </div>
    <div className={`${styles.filters} ${isOpen ? styles.filtersOpen : ""}`}>
      <label className={styles.field}>สถานะ
        <select name="stage" defaultValue={filters.stage ?? ""}>
          <option value="">ทุกสถานะ</option>{STAGE_CODES.map(stage => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</select></label>
      {owners && <label className={styles.field}>ฝ่ายขายผู้ดูแล
        <select name="owner" defaultValue={filters.owner ?? ""}>
          <option value="">ทุกคน</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label>}
      <label className={styles.field}>เรียงตาม
        <select name="order" defaultValue={`${filters.sort}:${filters.dir}`}>
          <option value="created:desc">บันทึกล่าสุดก่อน</option><option value="created:asc">บันทึกเก่าสุดก่อน</option>
          <option value="contact:desc">ติดต่อล่าสุดก่อน</option><option value="contact:asc">ติดต่อนานที่สุดก่อน</option></select></label>
      <label className={styles.field}>บันทึกตั้งแต่<input type="date" name="from" defaultValue={filters.from} /></label>
      <label className={styles.field}>ถึงวันที่<input type="date" name="to" defaultValue={filters.to} /></label>
    </div>
  </form>;
}
