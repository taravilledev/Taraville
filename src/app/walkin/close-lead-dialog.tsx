"use client";

import { useState } from "react";
import { secondaryActionClass } from "@/components/action-link-styles";
import { noticeClass } from "@/components/notice";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, type ActionState } from "./action-form";
import { RequiredMark } from "./required-mark";

type Props = {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  name: string; reasons: { code: string; label: string }[]; openWorkCount: number;
};

/** Reason dialog for closing a Lead (reversible, so a plain dialog: not red). */
export function CloseLeadDialog({ action, name, reasons, openWorkCount }: Props) {
  const [reason, setReason] = useState("");
  return <Dialog>
    <DialogTrigger className={secondaryActionClass}>ปิด Lead…</DialogTrigger>
    <DialogContent title={`ปิด Lead “${name}”?`} description="Lead จะย้ายไปแท็บ “ปิด” และไม่ขึ้นในรายการงานของคุณ ข้อมูลและประวัติยังอยู่ครบ เปิดกลับได้ทุกเมื่อ">
      {openWorkCount > 0 && <p className={noticeClass} role="note">ลูกค้ารายนี้ยังมีรายการขายที่ดำเนินอยู่ {openWorkCount} รายการ การปิด Lead ไม่ได้ยกเลิกรายการเหล่านั้น</p>}
      <ActionForm action={action} label="ปิด Lead">
        <input type="hidden" name="confirm_operation" value="on" />
        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="close-lead-reason">เหตุผลที่ปิด<RequiredMark /></FieldLabel>
            <NativeSelect id="close-lead-reason" wrapperClassName="w-full" name="reason" value={reason} onChange={event => setReason(event.target.value)} required>
              <option value="">เลือกเหตุผล</option>
              {reasons.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
            </NativeSelect>
          </Field>
          {reason === "other" && <Field>
            <FieldLabel htmlFor="close-lead-text">รายละเอียด<RequiredMark /></FieldLabel>
            <Textarea id="close-lead-text" name="reason_text" rows={3} maxLength={500} required />
          </Field>}
        </div>
      </ActionForm>
    </DialogContent>
  </Dialog>;
}
