"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MonthlyReport } from "@/lib/walkin/monthly-report";
import { PrintButton } from "./print-button";
import styles from "./report.module.css";

type Props = {
  month: string;
  latestMonth: string;
  brand?: MonthlyReport["leads"][number]["brand"];
  owner?: string;
  owners: MonthlyReport["owners"];
  printDisabled?: boolean;
};

export function ReportControls({ month, latestMonth, brand, owner, owners, printDisabled }: Props) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const monthInput = form.current?.querySelector<HTMLInputElement>('input[name="month"]');
    const brandSelect = form.current?.querySelector<HTMLSelectElement>('select[name="brand"]');
    const ownerSelect = form.current?.querySelector<HTMLSelectElement>('select[name="owner"]');
    if (monthInput) monthInput.value = month;
    if (brandSelect) brandSelect.value = brand ?? "";
    if (ownerSelect) ownerSelect.value = owner ?? "";
  }, [month, brand, owner]);

  function apply(filters: HTMLFormElement) {
    if (!filters.reportValidity()) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(filters)) {
      if (typeof value === "string" && value) params.set(key, value);
    }
    startTransition(() => router.replace(`/leads/report?${params}`, { scroll: false }));
  }

  return <form ref={form} className={`${styles.controls} ${styles.noPrint}`} method="get" action="/leads/report"
    onChange={event => apply(event.currentTarget)}
    onSubmit={event => { event.preventDefault(); apply(event.currentTarget); }}>
    <label className={styles.field}>เดือน
      <input type="month" name="month" defaultValue={month} max={latestMonth} required />
    </label>
    <label className={styles.field}>แบรนด์
      <select name="brand" defaultValue={brand ?? ""}>
        <option value="">ทั้งสองแบรนด์</option><option value="TARAVILLE">ธาราวิล</option><option value="BAAN_KUNAPAP">บ้านคุณภาพ</option>
      </select>
    </label>
    <label className={styles.field}>ผู้ดูแล
      <select name="owner" defaultValue={owner ?? ""}>
        <option value="">ทุกคน</option>{owners.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <PrintButton disabled={isPending || printDisabled} />
    <span className={styles.status} role="status">{isPending ? "กำลังโหลดรายงาน…" : ""}</span>
  </form>;
}
