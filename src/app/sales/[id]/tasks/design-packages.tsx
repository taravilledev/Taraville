"use client";

import { useEffect, useRef, useState } from "react";
import { designAreaPattern, designPackages, designTierForArea, sumDesignInstalments } from "@/lib/sales/design-fees";
import { formatMoney, parseMoney } from "@/lib/sales/money";
import styles from "../../sales.module.css";

const milestones = ["ส่งมอบแบบแปลน", "ส่งมอบ 3D", "ส่งมอบครบ"];
const number = new Intl.NumberFormat("th-TH");

export function DesignPackages({ initialArea, plan }: {
  initialArea: string;
  plan: { tier: string; instalments: string[]; note: string } | null | undefined;
}) {
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

  function amountInput(index: number) {
    return <input ref={index === 0 ? firstAmount : undefined} name={`instalment_${index + 1}`}
      aria-label={`${milestones[index]} (บาท)`} aria-invalid={error ? true : undefined}
      inputMode="decimal" required value={amounts[index]} onChange={event => {
        const value = event.target.value;
        setDraft({ tier, amounts: amounts.map((amount, position) => position === index ? value : amount) });
      }} />;
  }

  return <div className={styles.designPackages}>
    <fieldset className={styles.designChoices}>
      <legend>เลือกแพ็กเกจค่าออกแบบ</legend>
      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">{designPackages.map(item => {
        const isSelected = tier === item.id;
        const isEditing = isSelected && override;
        return <div key={item.id} className={styles.designPackage}>
          <label className={styles.designPackageHeading}>
            <input type="radio" name="design_package" value={item.id} checked={isSelected} disabled={!!areaTier} required={!areaTier} onChange={() => setChoice(item.id)} />
            {item.range}
          </label>
          <strong>{isEditing && target !== standardTotal && target !== null ? formatMoney(String(target)) : number.format(item.total)} บาท</strong>
          {isSelected && <label className={styles.designOverride}>
            <input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} />
            ปรับยอดงวด
          </label>}
          <dl>{item.amounts.map((amount, index) => <div key={milestones[index]}>
            <dt>{milestones[index]}</dt>
            <dd>{isEditing ? amountInput(index) : `${number.format(amount)} บาท`}</dd>
          </div>)}</dl>
          {isEditing && enteredTotal && <p className={styles.muted}>รวมยอดงวด {enteredTotal} บาท</p>}
          {isEditing && error && <p className={styles.designError} role="alert">{error}</p>}
          {item.id !== "under150" && <small className={styles.muted}>รวมรายการคำนวณวิศวกร</small>}
        </div>;
      })}</div>
      {!areaTier && <label className={styles.check}><input type="radio" name="design_package" value="custom" checked={tier === "custom"} required onChange={() => setChoice("custom")} />กำหนดแพ็กเกจเฉพาะงาน</label>}
    </fieldset>
    <label className={styles.field}>พื้นที่ใช้สอยจริง (ตร.ม.)
      <input name="usable_area" inputMode="decimal" pattern={designAreaPattern} required value={area} disabled={!tier && !area}
        onChange={event => setArea(event.target.value)} placeholder="เช่น 175.5" />
      <small className={styles.muted}>ต้องกรอกพื้นที่ใช้สอยจริงก่อนบันทึกและไปขั้นต่อไป ระบบจะเปลี่ยนแพ็กเกจเมื่อพื้นที่อยู่คนละช่วง</small>
    </label>
    {areaTier && <p className={styles.muted} role="status">{selected ? `พื้นที่ ${area} ตร.ม. อยู่ในช่วง ${selected.range}` : `พื้นที่ ${area} ตร.ม. ใช้ข้อตกลงค่าออกแบบเฉพาะงาน`}</p>}
    <p className={styles.muted}>สิ่งที่ได้รับทุกแพ็กเกจมาตรฐาน ได้แก่ แบบแปลน, 3D, แบบขออนุญาตก่อสร้าง และ BOQ สำหรับยื่นธนาคาร</p>
    <input type="hidden" name="tier" value={tier} />
    {(tier === "custom" || (override && selected)) && <input type="hidden" name="custom" value="on" />}
    {tier === "custom" && <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      {milestones.map((milestone, index) => <label className={styles.field} key={milestone}>{milestone} (บาท){amountInput(index)}</label>)}
    </div>}
    <label className={styles.field}>หมายเหตุ<textarea name="note" maxLength={3000} defaultValue={plan?.note} /></label>
  </div>;
}
