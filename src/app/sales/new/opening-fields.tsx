"use client";

import { nativeDialogClass, nativeDialogHeaderClass, nativeDialogBodyClass } from "@/components/native-dialog-styles";
import { useEffect, useId, useRef, useState } from "react";
import { ActionForm } from "@/app/walkin/action-form";
import { formatMoney } from "@/lib/sales/money";
import { createCase } from "../actions";
import styles from "../sales.module.css";
import { factsClass } from "@/components/facts";
import { pageHeaderClass } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Unit = { id: string; developmentId: string; code: string; location: string; address: string; details: Record<string, unknown>; price: string | null };
const detail = (unit: Unit, key: string) => typeof unit.details[key] === "string" && unit.details[key] ? unit.details[key] as string : "ยังไม่ระบุ";
const price = (unit: Unit) => unit.price === null ? "ยังไม่ระบุ" : `${formatMoney(unit.price)} บาท`;

export function OpeningFields({ units, leadId, requestId }: { units: Unit[]; leadId: string; requestId: string }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [developmentId, setDevelopmentId] = useState("");
  const [unit, setUnit] = useState<Unit | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const developments = [...new Map(units.map(item => [item.developmentId, { id: item.developmentId, label: item.location }])).values()];
  const search = query.trim().toLocaleLowerCase();
  const matches = units.filter(item => (!developmentId || item.developmentId === developmentId)
    && `${item.code} ${detail(item, "model")}`.toLocaleLowerCase().includes(search));
  useEffect(() => {
    if (unit) dialog.current?.showModal();
  }, [unit]);
  return <div className={styles.unitBrowser}>
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      <Field><FieldLabel htmlFor={`${id}-query`}>ค้นหาแปลงหรือแบบบ้าน</FieldLabel><Input id={`${id}-query`} type="search" placeholder="เลขแปลง หรือชื่อแบบบ้าน" value={query} onChange={event => setQuery(event.target.value)} /></Field>
      <Field>
        <FieldLabel htmlFor={`${id}-development`}>โครงการ</FieldLabel>
        <Combobox
          id={`${id}-development`}
          options={developments}
          value={developmentId}
          onValueChange={setDevelopmentId}
          placeholder="ทุกโครงการ"
          searchPlaceholder="ค้นหาโครงการ"
          emptyText="ไม่พบโครงการที่ตรงกับคำค้น"
        />
      </Field>
    </div>
    <div className={cn(pageHeaderClass, "items-center gap-2 [&_p]:m-0")}><h2>เลือกแปลงเพื่อเปิดโครงการ</h2><p role="status">{matches.length} จาก {units.length} แปลงว่าง</p></div>
    {!matches.length ? <div className={styles.unitEmpty}><strong>ไม่พบแปลงที่ตรงกับเงื่อนไข</strong><p>ลองเปลี่ยนคำค้นหรือล้างตัวกรองโครงการ</p></div> : <>
      <table className={styles.unitTable}>
        <caption className="sr-only">แปลงว่างที่เปิดใช้งาน เลือกดูรายละเอียดก่อนเปิดโครงการ</caption>
        <thead><tr><th scope="col">แปลง</th><th scope="col">โครงการ</th><th scope="col">แบบบ้าน</th><th scope="col">เนื้อที่ดิน<br />(ตร.ว.)</th><th scope="col">ราคาทะเบียน</th><th scope="col"><span className="sr-only">ดูรายละเอียด</span></th></tr></thead>
        <tbody>{matches.map(item => <tr key={item.id} onClick={event => {
          event.currentTarget.querySelector("button")?.focus(); setUnit(item);
        }}>
          <td><strong>{item.code}</strong></td><td>{item.location}</td><td>{detail(item, "model")}</td><td>{detail(item, "land_area")}</td><td className={styles.unitPrice}>{price(item)}</td>
          <td><button type="button" className={cn(buttonVariants({ variant: "outline", size: "auto" }), "p-2 text-primary text-[length:inherit]")} aria-haspopup="dialog" aria-label={`ดูรายละเอียดแปลง ${item.code} · ${item.location}`} onClick={event => { event.stopPropagation(); setUnit(item); }}>ดูรายละเอียด</button></td>
        </tr>)}</tbody>
      </table>
      <ul className={styles.unitCards}>{matches.map(item => <li key={item.id}>
        <button type="button" className={styles.unitCard} aria-haspopup="dialog" onClick={() => setUnit(item)}>
          <strong>แปลง {item.code}</strong><span className="text-sm text-muted-foreground">{item.location}</span><span>{detail(item, "model")}</span>
          <span className={styles.unitCardFooter}><strong>{price(item)}</strong><span>ดูรายละเอียด →</span></span>
        </button>
      </li>)}</ul>
    </>}
    <dialog ref={dialog} className={nativeDialogClass} aria-labelledby="plot-dialog-title" onClose={() => setUnit(null)} onCancel={event => {
      if (dialog.current?.querySelector("fieldset")?.disabled) event.preventDefault();
    }}>
      {unit && <ActionForm key={unit.id} action={createCase} label="เปิดโครงการด้วยแปลงนี้">
        <div className={`${nativeDialogHeaderClass} ${styles.unitDialogHeader}`}>
          <h2 id="plot-dialog-title">แปลง {unit.code}<span>โครงการ {unit.location}</span></h2>
          <button type="button" className={buttonVariants({ variant: "outline", size: "auto" })} onClick={() => dialog.current?.close()}>ปิด</button>
        </div>
        <div className={nativeDialogBodyClass}>
          <dl className={styles.unitModalPrice}><dt>ราคาทะเบียน</dt><dd>{price(unit)}</dd></dl>
          <dl className={`${factsClass} ${styles.unitPrimaryFacts}`}>
            {[["model", "แบบบ้าน"], ["land_area", "เนื้อที่ดิน (ตร.ว.)"], ["usable_area", "พื้นที่ใช้สอย (ตร.ม.)"], ["build_status", "สถานะก่อสร้าง"]].map(([key, label]) =>
              <div key={key}><dt>{label}</dt><dd>{detail(unit, key)}</dd></div>)}
          </dl>
          <dl className={`${factsClass} ${styles.unitSecondaryFacts}`}>
            <div><dt>ที่ตั้งโครงการ</dt><dd>{unit.address || "ยังไม่ระบุ"}</dd></div>
            <div><dt>ฟังก์ชันภายใน</dt><dd>{detail(unit, "layout")}</dd></div>
          </dl>
          <input type="hidden" name="lead_id" value={leadId} /><input type="hidden" name="unit_id" value={unit.id} />
          <input type="hidden" name="request_id" value={requestId} /><input type="hidden" name="project_id" value="" /><input type="hidden" name="customer_id" value="" />
        </div>
        <p className={styles.unitDraftNote}>เปิดเป็นร่าง ยังไม่จองหรือกันแปลง</p>
      </ActionForm>}
    </dialog>
  </div>;
}
