"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { periodPresets } from "./summary-model";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type Props = {
  q: string; owner: string; owners: string[]; stage: string; money: string; sort: string;
  sortOptions: { key: string; label: string }[] | null; presets: ReturnType<typeof periodPresets>;
  preset: string; from: string; to: string;
};

const controlClass = "inline-flex items-center gap-2 text-muted-foreground";

// Search, owner and period share one form (the page keys it by preset so "ล้างตัวกรอง" resets it); every change rewrites the URL so the server report re-renders in place (as /leads does).
export function SummaryControls({ q, owner, owners, stage, money, sort, sortOptions, presets, preset: initialPreset, from, to }: Props) {
  const id = useId();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [preset, setPreset] = useState(initialPreset);
  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(nextPreset: string) {
    if (!formRef.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(formRef.current)) {
      if (typeof value === "string" && value && key !== "period" && key !== "from" && key !== "to") params.append(key, value);
    }
    const chosen = presets.find(item => item.value === nextPreset);
    if (chosen) {
      params.set("view", "period");
      params.set("from", chosen.from);
      params.set("to", chosen.to);
    } else if (nextPreset === "custom") {
      const data = new FormData(formRef.current);
      params.set("view", "period");
      for (const key of ["from", "to"]) {
        const value = data.get(key);
        if (typeof value === "string" && value) params.set(key, value);
      }
    }
    const query = params.toString();
    router.replace(query ? `/summary?${query}` : "/summary", { scroll: false });
  }
  function onChange(event: ChangeEvent<HTMLFormElement>) {
    clearTimeout(timer.current);
    const { name, value } = event.target;
    if (name === "period") setPreset(value);
    const next = name === "period" ? value : preset;
    if (name === "q") timer.current = setTimeout(() => apply(next), 300);
    else apply(next);
  }
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    clearTimeout(timer.current);
    apply(preset);
  }

  return <form ref={formRef} className="flex flex-wrap items-center gap-2" action="/summary" method="get" onChange={onChange} onSubmit={onSubmit}>
    {stage && <input type="hidden" name="stage" value={stage} />}
    {money && <input type="hidden" name="money" value={money} />}
    {!sortOptions && sort && <input type="hidden" name="sort" value={sort} />}
    <label htmlFor={`${id}-q`} className="sr-only">ค้นหาโครงการ</label>
    <Input id={`${id}-q`} className="min-w-48 max-w-80 flex-[1_1_220px]" type="search" name="q" placeholder="รหัสโครงการหรือชื่อลูกค้า"
      defaultValue={q} maxLength={150} autoComplete="off" />
    <label htmlFor={`${id}-owner`} className={controlClass}>ผู้ดูแล
      <NativeSelect id={`${id}-owner`} name="owner" defaultValue={owner}>
        <option value="">ทุกคน</option>
        {owner && !owners.includes(owner) && <option value={owner}>{owner}</option>}
        {owners.map(name => <option key={name} value={name}>{name}</option>)}
      </NativeSelect>
    </label>
    <label htmlFor={`${id}-period`} className={controlClass}>ช่วงรับ/คืนเงิน
      <NativeSelect id={`${id}-period`} name="period" value={preset} onChange={() => undefined}>
        <option value="none">ไม่เลือกช่วง</option>
        {presets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        <option value="custom">กำหนดเอง…</option>
      </NativeSelect>
    </label>
    {preset === "custom" && <>
      <label htmlFor={`${id}-from`} className={controlClass}>ตั้งแต่<Input id={`${id}-from`} type="date" name="from" defaultValue={from} /></label>
      <label htmlFor={`${id}-to`} className={controlClass}>ถึง<Input id={`${id}-to`} type="date" name="to" defaultValue={to} /></label>
    </>}
    {sortOptions && <label htmlFor={`${id}-sort`} className={`${controlClass} min-[1024px]:hidden`}>เรียงตาม
      <NativeSelect id={`${id}-sort`} name="sort" defaultValue={sort}>
        <option value="">บิลเกินกำหนดก่อน</option>
        {sortOptions.map(option => <optgroup key={option.key} label={option.label}>
          <option value={`${option.key}.asc`}>{option.label} ↑</option>
          <option value={`${option.key}.desc`}>{option.label} ↓</option>
        </optgroup>)}
      </NativeSelect>
    </label>}
  </form>;
}
