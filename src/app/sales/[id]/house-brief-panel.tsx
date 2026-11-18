import { useId } from "react";
import { randomUUID } from "node:crypto";
import { ActionForm } from "@/app/walkin/action-form";
import type { CaseTab } from "@/lib/sales/case-progress";
import { houseBriefFields } from "@/lib/sales/house-brief";
import type { SalesCase } from "@/lib/sales/models";
import type { Task } from "@/lib/sales/tasks";
import { saveHouseBrief } from "../house-brief-actions";
import styles from "../sales.module.css";
import { factsClass } from "@/components/facts";
import { HouseBriefEditor } from "./house-brief-editor";
import { panelClass } from "@/components/panel";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const fieldGroups = ([
  { label: "ตัวบ้าน", keys: ["model", "usable_area", "stories", "roof"] },
  { label: "จำนวนห้อง", keys: ["bedrooms", "living_rooms", "bathrooms", "kitchens"] },
  { label: "งบและความต้องการเพิ่มเติม", keys: ["budget", "payment_method", "layout"] },
] as const).map(({ label, keys }) => ({
  label,
  fields: keys.map(key => houseBriefFields.find(field => field.key === key)!),
}));

const fields = fieldGroups.flatMap(group => group.fields);

export function HouseBriefPanel({ sale, task, tab }: { sale: SalesCase; task?: Task; tab: CaseTab }) {
  const id = useId();
  if (sale.brand !== "BAAN_KUNAPAP" || !sale.can_finance) return null;
  const brief = sale.house_brief ?? {};
  const canEdit = sale.permissions["financial.prepare"] && sale.status !== "cancelled";
  const filledFields = fields.filter(({ key }) => brief[key]);
  const summary = filledFields.length > 0
    ? <dl className={`${factsClass} ${styles.houseBriefFacts}`}>{filledFields.map(({ key, label }) =>
      <div key={key} className={key === "layout" ? "col-span-full" : undefined}><dt>{label}</dt><dd>{brief[key]}</dd></div>)}</dl>
    : <p className="text-sm text-muted-foreground">ยังไม่ได้ระบุความต้องการบ้าน</p>;

  return <section className={`${panelClass} ${styles.houseBrief}`} aria-labelledby="house-brief">
    {canEdit ? <HouseBriefEditor key={`${sale.id}:${sale.version}`}
      label={filledFields.length > 0 ? "แก้ไขความต้องการ" : "เพิ่มความต้องการ"} summary={summary}>
      <ActionForm action={saveHouseBrief.bind(null, {
        id: sale.id, version: sale.version, requestId: randomUUID(), task: task?.name, row: task?.row, tab,
      })} label="บันทึกความต้องการบ้าน">
        {fieldGroups.map(({ label, fields }) => <fieldset key={label} className={styles.houseBriefGroup}>
          <legend>{label}</legend>
          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">{fields.map(field =>
            <Field key={field.key} className={field.key === "layout" ? "col-span-full" : undefined}>
              <FieldLabel htmlFor={`${id}-${field.key}`}>{field.label}</FieldLabel>
              {field.key === "payment_method" ? <NativeSelect id={`${id}-${field.key}`} name={field.key} defaultValue={brief[field.key] ?? ""}>
                <option value="">ยังไม่ระบุ</option><option>เงินสด</option><option>สินเชื่อธนาคาร</option>
              </NativeSelect> : field.key === "layout" ? <Textarea id={`${id}-${field.key}`} className="min-h-[100px]" name={field.key} defaultValue={brief[field.key] ?? ""} maxLength={1000} />
                : <Input id={`${id}-${field.key}`} name={field.key} defaultValue={brief[field.key] ?? ""}
                inputMode={"mode" in field ? field.mode : undefined}
                maxLength={"mode" in field && field.mode === "numeric" ? 3 : 200} />}
            </Field>)}</div>
        </fieldset>)}
      </ActionForm>
    </HouseBriefEditor> : <><h2 id="house-brief">ความต้องการบ้าน</h2>{summary}</>}
  </section>;
}
