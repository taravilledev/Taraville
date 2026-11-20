"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listHref, type LeadFilters, type surveyFilterOptions } from "@/lib/walkin/lead-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

const RANGES = [["all", "ทุกช่วงเวลา"], ["week", "7 วันล่าสุด"], ["month", "เดือนนี้"], ["custom", "กำหนดเอง…"]] as const;
const pillClass = "inline-flex min-h-9 cursor-pointer items-center rounded-full border border-line-strong bg-card px-3 text-sm has-checked:border-primary has-checked:bg-primary-tint has-checked:font-semibold has-checked:text-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary";

// The pill is the label; the real input stays in the form so FormData and the keyboard work unchanged.
function Pill({ type, name, value, checked, children }: { type: "checkbox" | "radio"; name: string; value: string; checked: boolean; children: string }) {
  return <label className={pillClass}><input className="sr-only" type={type} name={name} value={value} checked={checked} onChange={() => undefined} />{children}</label>;
}

type Props = {
  filters: LeadFilters; owners: { id: string; full_name: string }[]; selfId?: string; activeCount: number;
  survey: ReturnType<typeof surveyFilterOptions>; selected: { budget: string[]; channel: string[] };
};

// Search, owner and the "ตัวกรอง" panel share one form; every change rewrites the URL so the server list re-renders in place.
export function ListControls({ filters, owners, selfId, activeCount, survey, selected }: Props) {
  const id = useId();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const range = filters.range ?? (filters.from || filters.to ? "custom" : "all");

  function apply() {
    if (!formRef.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(formRef.current)) if (typeof value === "string" && value && !(key === "range" && value === "all")) params.append(key, value);
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

  return <form ref={formRef} className={cn("flex min-w-0 flex-[1_1_320px] flex-wrap items-center gap-2", isOpen && "basis-full")} action="/leads" method="get" onChange={onChange} onSubmit={onSubmit}>
    {filters.brand && <input type="hidden" name="brand" value={filters.brand} />}
    {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
    {filters.dir !== "desc" && <input type="hidden" name="dir" value={filters.dir} />}
    <label htmlFor={`${id}-q`} className="sr-only">ค้นหาชื่อ เบอร์โทร LINE ID หรือทำเลที่สนใจ</label>
    <Input id={`${id}-q`} className="min-w-48 flex-[1_1_200px]" type="search" name="q" placeholder="ค้นหาชื่อ เบอร์โทร หรือ LINE ID" defaultValue={filters.q} maxLength={50} autoComplete="off" />
    <label htmlFor={`${id}-owner`} className="inline-flex items-center gap-2 text-muted-foreground">ผู้ดูแล
      <NativeSelect id={`${id}-owner`} name="owner" defaultValue={filters.owner ?? "all"}>
        <option value="all">ทุกคน</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.id === selfId ? "ฉัน" : owner.full_name}</option>)}
      </NativeSelect>
    </label>
    <Button type="button" variant="outline" className={cn(activeCount > 0 && "border-primary bg-primary-tint text-primary")} aria-controls="lead-filters" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
      ตัวกรอง{activeCount > 0 ? ` (${activeCount})` : ""}</Button>
    <div id="lead-filters" className={cn("mt-1 basis-full gap-4 rounded-lg border bg-card p-4", isOpen ? "grid" : "hidden")}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-x-7 gap-y-4">
        <fieldset className="m-0 grid min-w-0 content-start gap-2 border-0 p-0"><legend className="mb-2 p-0 font-semibold">ลงทะเบียน</legend>
          <div className="flex flex-wrap gap-1.5">{RANGES.map(([value, label]) => <Pill key={value} type="radio" name="range" value={value} checked={range === value}>{label}</Pill>)}</div>
          {range === "custom" && <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="ลงทะเบียนตั้งแต่" className="w-auto" type="date" name="from" defaultValue={filters.from} />–
            <Input aria-label="ลงทะเบียนถึง" className="w-auto" type="date" name="to" defaultValue={filters.to} /></div>}
        </fieldset>
        {survey && <>
          <fieldset className="m-0 grid min-w-0 content-start gap-2 border-0 p-0"><legend className="mb-2 p-0 font-semibold">{survey.budgetLabel}</legend>
            <div className="flex flex-wrap gap-1.5">{survey.budget.map(option => <Pill key={option} type="checkbox" name="budget" value={option} checked={selected.budget.includes(option)}>{option}</Pill>)}</div>
          </fieldset>
          <fieldset className="m-0 grid min-w-0 content-start gap-2 border-0 p-0"><legend className="mb-2 p-0 font-semibold">รู้จักจากช่องทาง</legend>
            <div className="flex flex-wrap gap-1.5">{survey.channel.map(option => <Pill key={option} type="checkbox" name="channel" value={option} checked={selected.channel.includes(option)}>{option}</Pill>)}</div>
          </fieldset>
        </>}
      </div>
      {!survey && <p className="m-0 rounded-md bg-muted px-3 py-2 text-muted-foreground">กรองตามงบ/ค่างวด และช่องทางได้หลังเลือกแบรนด์ด้านบน เพราะคำถามในแบบสอบถามของสองแบรนด์ไม่เหมือนกัน</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground">ผลในตารางเปลี่ยนทันทีที่เลือก · เลือกได้หลายค่าในแต่ละหัวข้อ</span>
        <span className="inline-flex gap-2">
          <Link className="inline-flex min-h-9 items-center px-3 font-semibold text-primary no-underline" prefetch={false} href={listHref(filters, { from: undefined, to: undefined, range: undefined, budget: undefined, channel: undefined, page: undefined })}>ล้างตัวกรองเพิ่มเติม</Link>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)}>ปิด</Button>
        </span>
      </div>
    </div>
  </form>;
}
