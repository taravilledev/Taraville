"use client";

import { useEffect, useId, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MonthlyReport } from "@/lib/walkin/monthly-report";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import styles from "./report.module.css";

type Props = {
  month: string;
  latestMonth: string;
  brand?: MonthlyReport["leads"][number]["brand"];
  owner?: string;
  owners: MonthlyReport["owners"];
  isSale: boolean;
};

export function ReportControls({ month, latestMonth, brand, owner, owners, isSale }: Props) {
  const id = useId();
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

  return <form ref={form} className={`flex flex-wrap items-end gap-x-4 gap-y-3 ${styles.noPrint}`} method="get" action="/leads/report"
    onChange={event => apply(event.currentTarget)}
    onSubmit={event => { event.preventDefault(); apply(event.currentTarget); }}>
    <Field className="w-auto"><FieldLabel htmlFor={`${id}-month`}>เดือน</FieldLabel>
      <Input id={`${id}-month`} type="month" name="month" defaultValue={month} max={latestMonth} required />
    </Field>
    <Field className="w-auto"><FieldLabel htmlFor={`${id}-brand`}>แบรนด์</FieldLabel>
      <NativeSelect id={`${id}-brand`} name="brand" defaultValue={brand ?? ""}>
        <option value="">ทั้งสองแบรนด์</option><option value="TARAVILLE">ธาราวิลล์</option><option value="BAAN_KUNAPAP">บ้านคุณภาพ</option>
      </NativeSelect>
    </Field>
    {!isSale && <Field className="w-auto"><FieldLabel htmlFor={`${id}-owner`}>ผู้ดูแล</FieldLabel>
      <NativeSelect id={`${id}-owner`} name="owner" defaultValue={owner ?? ""}>
        <option value="">ทุกคน</option>{owners.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </NativeSelect>
    </Field>}
    <span className="self-center text-sm text-muted-foreground" role="status">{isPending ? "กำลังโหลดรายงาน…" : ""}</span>
  </form>;
}
