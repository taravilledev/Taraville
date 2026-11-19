"use client";

import { useEffect, useId, useRef, useState } from "react";
import { designAreaPattern, designPackages, designTierForArea, sumDesignInstalments } from "@/lib/sales/design-fees";
import { formatMoney, parseMoney } from "@/lib/sales/money";
import { checkRowClass } from "@/components/check-row";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const milestones = ["ส่งมอบแบบแปลน", "ส่งมอบ 3D", "ส่งมอบครบ"];
const number = new Intl.NumberFormat("th-TH");

const packageClass = "relative grid cursor-pointer content-start gap-2 rounded-md border border-line-strong p-4 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:shadow-[inset_0_0_0_1px_var(--primary)] " +
  "has-[:disabled]:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-primary [&>strong]:text-lg " +
  "[&_dl]:mt-1 [&_dl]:grid [&_dl]:gap-1 [&_dl]:border-t [&_dl]:pt-2 [&_dl]:text-sm [&_dl_div]:flex [&_dl_div]:flex-wrap [&_dl_div]:justify-between [&_dl_div]:gap-2 " +
  "[&_dd]:m-0 [&_dd]:font-semibold [&_dd_input]:relative [&_dd_input]:z-10 [&_dd_input]:w-32 [&_dd_input]:max-w-full [&_dd_input]:text-end";

export function DesignPackages({ initialArea, plan }: {
  initialArea: string;
  plan: { tier: string; instalments: string[]; note: string } | null | undefined;
}) {
  const id = useId();
  const [area, setArea] = useState(initialArea);
  const [choice, setChoice] = useState(plan?.tier ?? "");
  const [override, setOverride] = useState(() => {
    const preset = designPackages.find(item => item.id === plan?.tier);
    return !!plan && !!preset && preset.amounts.some((amount, index) => String(amount * 100) !== plan.instalments[index]);
  });
  const [draft, setDraft] = useState(() => plan ? {
    tier: plan.tier, amounts: plan.instalments.map(amount => formatMoney(amount).replaceAll(",", "")),
  } : null);
  const firstAmount = useRef<HTMLInputElement>(null);
  const areaTier = designTierForArea(area);
  const tier = areaTier ?? choice;
  const selected = designPackages.find(item => item.id === tier);
  const amounts = draft?.tier === tier ? draft.amounts : selected?.amounts.map(String) ?? ["", "", ""];
  const standardTotal = selected ? BigInt(selected.total * 100) : null;
  const target = override && plan?.tier === tier ? sumDesignInstalments(plan.instalments) : standardTotal;
  let error = "";
  let enteredTotal = "";
  if (override && selected && target !== null) {
    try {
      const total = sumDesignInstalments(amounts.map(parseMoney));
      enteredTotal = formatMoney(String(total));
      if (total !== target) error = `ยอดทั้ง 3 งวดต้องรวมกันเป็น ${formatMoney(String(target))} บาท`;
    } catch {
      error = "กรอกยอดเงินทั้ง 3 งวดเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง";
    }
  }
  useEffect(() => {
    firstAmount.current?.setCustomValidity(error);
  }, [error, tier, override]);

  function amountInput(index: number, fieldId?: string) {
    const props = {
      ref: index === 0 ? firstAmount : undefined, name: `instalment_${index + 1}`,
      "aria-label": `${milestones[index]} (บาท)`, "aria-invalid": error ? true : undefined,
      inputMode: "decimal" as const, required: true, value: amounts[index], onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setDraft({ tier, amounts: amounts.map((amount, position) => position === index ? value : amount) });
      },
    };
    return fieldId ? <Input id={fieldId} {...props} /> : <input {...props} />;
  }

  return <div className="grid gap-4 [&_p]:m-0">
    <fieldset className="m-0 min-w-0 border-0 p-0 [&>p]:mb-3 [&_legend]:mb-3 [&_legend]:font-bold">
      <legend>เลือกแพ็กเกจค่าออกแบบ</legend>
      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">{designPackages.map(item => {
        const isSelected = tier === item.id;
        const isEditing = isSelected && override;
        return <div key={item.id} className={packageClass}>
          <label className="flex items-center gap-2 font-semibold has-[input:enabled]:after:absolute has-[input:enabled]:after:inset-0 has-[input:enabled]:after:cursor-pointer has-[input:enabled]:after:content-[''] [&_input]:accent-primary">
            <input type="radio" name="design_package" value={item.id} checked={isSelected} disabled={!!areaTier} required={!areaTier} onChange={() => setChoice(item.id)} />
            {item.range}
          </label>
          <strong>{isEditing && target !== standardTotal && target !== null ? formatMoney(String(target)) : number.format(item.total)} บาท</strong>
          {isSelected && <label className="relative z-10 flex min-h-(--tap-min) cursor-pointer items-center gap-2">
            <input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} />
            ปรับยอดงวด
          </label>}
          <dl>{item.amounts.map((amount, index) => <div key={milestones[index]}>
            <dt>{milestones[index]}</dt>
            <dd>{isEditing ? amountInput(index) : `${number.format(amount)} บาท`}</dd>
          </div>)}</dl>
          {isEditing && enteredTotal && <p className="text-sm text-muted-foreground">รวมยอดงวด {enteredTotal} บาท</p>}
          {isEditing && error && <p className="text-sm text-warn-ink" role="alert">{error}</p>}
          {item.id !== "under150" && <small className="text-sm text-muted-foreground">รวมรายการคำนวณวิศวกร</small>}
        </div>;
      })}</div>
      {!areaTier && <label className={cn(checkRowClass, "mt-2")}><input type="radio" name="design_package" value="custom" checked={tier === "custom"} required onChange={() => setChoice("custom")} />กำหนดแพ็กเกจเฉพาะงาน</label>}
    </fieldset>
    <Field><FieldLabel htmlFor={`${id}-usable_area`}>พื้นที่ใช้สอยจริง (ตร.ม.)</FieldLabel><Input id={`${id}-usable_area`} aria-describedby={`${id}-usable_area-hint`} name="usable_area" inputMode="decimal" pattern={designAreaPattern} required value={area} disabled={!tier && !area}
        onChange={event => setArea(event.target.value)} placeholder="เช่น 175.5" /><FieldDescription id={`${id}-usable_area-hint`}>ต้องกรอกพื้นที่ใช้สอยจริงก่อนบันทึกและไปขั้นต่อไป ระบบจะเปลี่ยนแพ็กเกจเมื่อพื้นที่อยู่คนละช่วง</FieldDescription></Field>
    {areaTier && <p className="text-sm text-muted-foreground" role="status">{selected ? `พื้นที่ ${area} ตร.ม. อยู่ในช่วง ${selected.range}` : `พื้นที่ ${area} ตร.ม. ใช้ข้อตกลงค่าออกแบบเฉพาะงาน`}</p>}
    <p className="text-sm text-muted-foreground">สิ่งที่ได้รับทุกแพ็กเกจมาตรฐาน ได้แก่ แบบแปลน, 3D, แบบขออนุญาตก่อสร้าง และ BOQ สำหรับยื่นธนาคาร</p>
    <input type="hidden" name="tier" value={tier} />
    {(tier === "custom" || (override && selected)) && <input type="hidden" name="custom" value="on" />}
    {tier === "custom" && <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      {milestones.map((milestone, index) => <Field key={milestone}>
        <FieldLabel htmlFor={`${id}-instalment-${index + 1}`}>{milestone} (บาท)</FieldLabel>{amountInput(index, `${id}-instalment-${index + 1}`)}
      </Field>)}
    </div>}
    <Field><FieldLabel htmlFor={`${id}-note`}>หมายเหตุ</FieldLabel><Textarea id={`${id}-note`} className="min-h-[100px]" name="note" maxLength={3000} defaultValue={plan?.note} /></Field>
  </div>;
}
