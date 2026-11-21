import { PHONE_HINT, PHONE_PATTERN } from "@/lib/walkin/phone";
import type { Lead, Staff } from "@/lib/walkin/models";
import { SURVEY_QUESTIONS, type Brand } from "@/lib/walkin/survey-questions";
import { SurveyField } from "./survey-field";
import { ActionForm } from "./action-form";
import { saveLead } from "./actions";
import { ConsentFields, SurveyConsent } from "./consent-fields";
import { NoticeDialog } from "./notice-dialog";
import { RequiredMark } from "./required-mark";
import { VersionedNotice } from "./versioned-notice";
import { formCardClass, formHintClass, sectionHeadingClass } from "@/components/form-card";
import { walkinFieldClass } from "./walkin-form-styles";
import { NativeSelect } from "@/components/ui/native-select";

export const LEAD_FORM_ID = "lead-form";

export function LeadForm({ brand, staff, owners, lead, requestId, choice = null }: {
  brand: Brand; staff: Staff; owners: Staff[]; lead?: Lead; requestId: string; choice?: boolean | null;
}) {
  const questions = SURVEY_QUESTIONS[brand];
  const context = { brand, requestId, ...(lead ? { id: lead.id, version: lead.version } : {}) };
  const isSurveyShown = lead ? choice !== false : true;
  const isBkp = brand === "BAAN_KUNAPAP";
  const survey = <div className="flex flex-col gap-6 [&:not(:has(input[name='survey.decision\_factors'][value='ทำเลที่ตั้ง']:checked))_label[for=survey-preferred\_location]]:hidden">{questions.filter(question => question.key !== "sales_staff" && (!question.legacy || lead?.survey[question.key])).map(question =>
    <SurveyField key={question.key} question={question} answers={lead?.survey} />)}</div>;
  return <>
    {!lead && <NoticeDialog><VersionedNotice brand={brand} /></NoticeDialog>}
    <ActionForm id={LEAD_FORM_ID} sticky action={saveLead.bind(null, context)}>
      <section id="contact" className={formCardClass} aria-labelledby="contact-title">
        <div className={sectionHeadingClass}><h2 id="contact-title">ข้อมูลติดต่อ</h2><span>ช่องที่มี<RequiredMark />เป็นข้อมูลจำเป็น</span></div>
        <div className="grid grid-cols-[125px_1fr_1fr] gap-4 max-[640px]:grid-cols-1">
          <label data-slot="walkin-field" className={walkinFieldClass}>คำนำหน้า<NativeSelect wrapperClassName="w-full" className="pr-9!" name="name_title" defaultValue={lead?.name_title ?? ""} autoComplete="honorific-prefix">
            <option value="">ไม่ระบุ</option><option>นาย</option><option>นาง</option><option>นางสาว</option>
          </NativeSelect></label>
          <label data-slot="walkin-field" className={walkinFieldClass}><span>ชื่อ<RequiredMark /></span><input name="first_name" defaultValue={lead?.first_name} autoComplete="given-name" required maxLength={200} /></label>
          <label data-slot="walkin-field" className={walkinFieldClass}>นามสกุล<input name="last_name" defaultValue={lead?.last_name} autoComplete="family-name" maxLength={200} /></label>
        </div>
        <div className="my-6 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <label data-slot="walkin-field" className={walkinFieldClass}><span>เบอร์โทรศัพท์มือถือ<RequiredMark /></span><input name="phone" type="tel" inputMode="tel" defaultValue={lead?.phone} autoComplete="tel" required maxLength={80}
            pattern={isBkp ? PHONE_PATTERN : undefined} title={isBkp ? PHONE_HINT : undefined}
            aria-describedby={isBkp ? "lead-phone-hint" : undefined} />
            {isBkp && <small id="lead-phone-hint">{PHONE_HINT}</small>}</label>
          <label data-slot="walkin-field" className={walkinFieldClass}>LINE ID<input name="line_id" defaultValue={lead?.line_id} autoComplete="off" maxLength={200} /></label>
        </div>
        {!lead && staff.role === "executive" ? <label data-slot="walkin-field" className={walkinFieldClass}><span>ฝ่ายขายผู้ดูแล<RequiredMark /></span>
          <NativeSelect wrapperClassName="w-full" className="pr-9!" name="owner_id" required defaultValue=""><option value="">เลือกฝ่ายขาย</option>
            {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
          </NativeSelect></label> : <input type="hidden" name="owner_id" value={lead?.owner_id ?? staff.id} />}
      </section>
      {isSurveyShown ? <section id="survey" className={formCardClass} aria-labelledby="survey-title">
        <h2 id="survey-title">แบบสอบถามความต้องการ</h2><p className="-mt-3 mb-6 text-sm text-muted-foreground">ไม่บังคับ ข้อที่ลูกค้าไม่ตอบ เว้นว่างได้</p>
        {lead ? survey : <SurveyConsent>{survey}</SurveyConsent>}
      </section> : <p className={formHintClass} role="status">ลูกค้าไม่ให้ข้อมูลแบบสอบถามเพิ่มเติม · เปลี่ยนตัวเลือกได้จากหน้ารายละเอียด</p>}
      {!lead && <ConsentFields />}
    </ActionForm>
  </>;
}
