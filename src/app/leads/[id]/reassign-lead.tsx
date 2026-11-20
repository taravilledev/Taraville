import { NativeSelect } from "@/components/ui/native-select";
import { Field, FieldLabel } from "@/components/ui/field";
import type { Lead, Staff } from "@/lib/walkin/models";
import { RequiredMark } from "@/app/walkin/required-mark";
import { ActionForm } from "@/app/walkin/action-form";
import { reassignLead } from "@/app/walkin/actions";
import { formHintClass } from "@/components/form-card";

/** Inside the owner drawer (Executive only). */
export function ReassignLead({ lead, owners }: { lead: Lead; owners: Staff[] }) {
  return <ActionForm action={reassignLead.bind(null, lead.id, lead.version)} label="เปลี่ยนผู้ดูแล">
    <Field>
      <FieldLabel htmlFor="lead-owner">ฝ่ายขายผู้ดูแล<RequiredMark /></FieldLabel>
      <NativeSelect id="lead-owner" wrapperClassName="w-full" name="owner_id" defaultValue={owners.some(owner => owner.id === lead.owner_id) ? lead.owner_id : ""} required>
        <option value="">เลือกฝ่ายขาย</option>
        {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
      </NativeSelect>
    </Field>
    <p className={formHintClass}>ผู้ดูแลคนใหม่จะแก้ไขรายการนี้ได้ ผู้ดูแลเดิมยังดูข้อมูลได้</p>
  </ActionForm>;
}
