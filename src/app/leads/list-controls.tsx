"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LeadFilters } from "@/lib/walkin/lead-list";
import { STAGE_CODES, STAGE_LABELS } from "@/lib/walkin/lead-stage";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type Props = { filters: LeadFilters; owners?: { id: string; full_name: string }[]; activeCount: number };

// Search and filters share one form; every change rewrites the URL so the server list re-renders in place.
export function ListControls({ filters, owners, activeCount }: Props) {
  const id = useId();
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

  return <form ref={formRef} className={cn("min-w-0 flex-[1_1_320px]", isOpen && "basis-full")} action="/leads" method="get" onChange={onChange} onSubmit={onSubmit}>
    {filters.brand && <input type="hidden" name="brand" value={filters.brand} />}
    {filters.closed && <input type="hidden" name="closed" value={filters.closed} />}
    <div className="flex items-end gap-3 max-[400px]:gap-2">
      <Field className="flex-1"><FieldLabel htmlFor={`${id}-q`} className="sr-only">ค้นหาชื่อ เบอร์โทร หรือ LINE ID</FieldLabel>
        <Input id={`${id}-q`} type="search" name="q" placeholder="ค้นหาชื่อ เบอร์โทร หรือ LINE ID" defaultValue={filters.q} maxLength={50} autoComplete="off" /></Field>
      <Button type="button" variant="outline" className="border-primary font-bold text-primary max-[400px]:px-3" aria-controls="lead-filters" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
        ตัวกรอง{activeCount > 0 ? ` (${activeCount})` : ""}</Button>
    </div>
    <div id="lead-filters" className={cn("mt-3 grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3", isOpen ? "grid" : "hidden")}>
      <Field><FieldLabel htmlFor={`${id}-stage`}>สถานะ</FieldLabel>
        <NativeSelect id={`${id}-stage`} name="stage" defaultValue={filters.stage ?? ""}>
          <option value="">ทุกสถานะ</option>{STAGE_CODES.map(stage => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</NativeSelect></Field>
      {owners && <Field><FieldLabel htmlFor={`${id}-owner`}>ฝ่ายขายผู้ดูแล</FieldLabel>
        <NativeSelect id={`${id}-owner`} name="owner" defaultValue={filters.owner ?? ""}>
          <option value="">ทุกคน</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</NativeSelect></Field>}
      <Field><FieldLabel htmlFor={`${id}-order`}>เรียงตาม</FieldLabel>
        <NativeSelect id={`${id}-order`} name="order" defaultValue={`${filters.sort}:${filters.dir}`}>
          <option value="created:desc">บันทึกล่าสุดก่อน</option><option value="created:asc">บันทึกเก่าสุดก่อน</option>
          <option value="contact:desc">ติดต่อล่าสุดก่อน</option><option value="contact:asc">ติดต่อนานที่สุดก่อน</option></NativeSelect></Field>
      <Field><FieldLabel htmlFor={`${id}-from`}>บันทึกตั้งแต่</FieldLabel><Input id={`${id}-from`} type="date" name="from" defaultValue={filters.from} /></Field>
      <Field><FieldLabel htmlFor={`${id}-to`}>ถึงวันที่</FieldLabel><Input id={`${id}-to`} type="date" name="to" defaultValue={filters.to} /></Field>
    </div>
  </form>;
}
