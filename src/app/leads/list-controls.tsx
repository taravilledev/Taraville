"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LeadFilters } from "@/lib/walkin/lead-list";
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
    if (params.get("sort") === "created") params.delete("sort");
    if (params.get("dir") === "desc") params.delete("dir");
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
    <input type="hidden" name="sort" value={filters.sort} />
    <input type="hidden" name="dir" value={filters.dir} />
    <div className={styles.searchRow}>
      <label className={styles.field}>ค้นหาชื่อ เบอร์โทร หรือ LINE ID
        <input type="search" name="q" defaultValue={filters.q} maxLength={50} autoComplete="off" /></label>
      <button type="button" className={styles.filterToggle} aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
        ตัวกรอง{activeCount > 0 ? ` (${activeCount})` : ""}</button>
    </div>
    <div className={`${styles.filters} ${isOpen ? styles.filtersOpen : ""}`}>
      <label className={styles.field}>แบรนด์
        <select name="brand" defaultValue={filters.brand ?? ""}>
          <option value="">ทุกแบรนด์</option><option value="BAAN_KUNAPAP">บ้านคุณภาพ</option><option value="TARAVILLE">Taraville</option></select></label>
      {owners && <label className={styles.field}>ฝ่ายขายผู้ดูแล
        <select name="owner" defaultValue={filters.owner ?? ""}>
          <option value="">ทุกคน</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label>}
      <label className={styles.field}>บันทึกตั้งแต่<input type="date" name="from" defaultValue={filters.from} /></label>
      <label className={styles.field}>ถึงวันที่<input type="date" name="to" defaultValue={filters.to} /></label>
    </div>
  </form>;
}
