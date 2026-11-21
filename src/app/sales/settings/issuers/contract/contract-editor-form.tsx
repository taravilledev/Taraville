"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/walkin/action-form";
import { primaryActionClass, secondaryActionClass } from "@/components/action-link-styles";
import { formErrorClass } from "@/components/form-feedback";
import { checkRowClass } from "@/components/check-row";
import { Notice } from "@/components/notice";
import { Panel } from "@/components/panel";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type Issuer = { legal_name: string; address: string; tax_id: string; contact: string; contract_text: string; is_synthetic: boolean };

/**
 * Two explicit saves. Only the approve button posts contract_text_approved, because saveIssuer reads its absence as "not approved".
 * The company fields are resent unchanged; test mode (is_synthetic) is resent only when currently on (ADR 0062).
 */
export function ContractEditorForm({ action, issuer, brandName, needsApproval, isApproved, cancelHref }: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  issuer?: Issuer; brandName: string; needsApproval: boolean; isApproved: boolean; cancelHref: string;
}) {
  const [state, submit, isPending] = useActionState((previous: ActionState, data: FormData) => action(previous, data), { error: "" });
  return <form action={submit} className="grid min-w-0 max-w-[900px] gap-6">
    <fieldset className="m-0 grid min-w-0 gap-6 border-0 p-0" disabled={isPending}>
      <Panel className="grid min-w-0 gap-4">
        <Field>
          <FieldLabel htmlFor="issuer-contract_text">ข้อความข้อ 3–14</FieldLabel>
          <Textarea id="issuer-contract_text" aria-describedby="issuer-contract_text-hint" name="contract_text" className="min-h-[360px]"
            maxLength={100000} required defaultValue={issuer?.contract_text} />
          <FieldDescription id="issuer-contract_text-hint">ใช้กับสัญญาก่อสร้างของ{brandName}ทุกฉบับ</FieldDescription>
        </Field>
        {(["legal_name", "address", "tax_id", "contact"] as const).map(key => <input key={key} type="hidden" name={key} value={issuer?.[key] ?? ""} />)}
        {issuer?.is_synthetic && <input type="hidden" name="is_synthetic" value="on" />}
      </Panel>
      <Notice>
        <strong>มีผลกับร่างสัญญาที่บันทึกไว้แล้ว</strong> · ร่างที่ใช้ข้อความเดิม ต้องเปิดแล้วบันทึกร่างอีกครั้งก่อนล็อก · หน้าล็อกสัญญาจะบอกให้เอง
      </Notice>
      {needsApproval && isApproved && <Notice>บันทึกเป็นร่างจะยกเลิกการอนุมัติที่มีอยู่ · ล็อกสัญญา{brandName}ไม่ได้จนกว่าจะอนุมัติอีกครั้ง</Notice>}
      {needsApproval && <label className={checkRowClass}><input type="checkbox" name="confirm_review" required />ตรวจข้อความแล้ว ใช้กับสัญญาฉบับใหม่ทันที</label>}
    </fieldset>
    {state.error && <p className={formErrorClass} role="alert">{state.error}</p>}
    <div className="flex flex-wrap items-center gap-3 max-[640px]:flex-col max-[640px]:items-stretch">
      {needsApproval && <>
        <button type="submit" name="contract_text_approved" value="on" className={primaryActionClass} disabled={isPending}>
          {isPending ? "กำลังดำเนินการ…" : "บันทึกและอนุมัติให้ใช้จริง"}
        </button>
        <button type="submit" formNoValidate className={secondaryActionClass} disabled={isPending}>บันทึกเป็นร่าง (ยังไม่อนุมัติ)</button>
      </>}
      {!needsApproval && <button type="submit" className={primaryActionClass} disabled={isPending}>{isPending ? "กำลังดำเนินการ…" : "บันทึกข้อความสัญญา"}</button>}
      <a className={secondaryActionClass} href={cancelHref}>ยกเลิก</a>
    </div>
    {needsApproval && <p className="m-0 text-sm text-muted-foreground">อนุมัติได้เมื่อมีข้อความ · ร่างยังไม่ใช้ล็อกสัญญา</p>}
  </form>;
}
