import { PRIVACY_NOTICE } from "@/lib/walkin/privacy";
import { NoticeLink } from "./notice-dialog";
import { formCardClass, formHintClass } from "@/components/form-card";
import { walkinOptionClass } from "./walkin-form-styles";

// The checkbox stays uncontrolled: the form reads it, and `isConsent` only picks the hint.
export function SurveyConsent({ isConsent }: { isConsent: boolean }) {
  return <>
    <label className={walkinOptionClass}>
      <input type="checkbox" name="survey_consent" value="yes" />
      <span>{PRIVACY_NOTICE.choices.survey_consent}</span>
    </label>
    <p className="m-0 mt-2 text-sm text-muted-foreground" role="status">{isConsent
      ? "ลูกค้ายินยอมแล้ว · คำตอบจะบันทึกพร้อม Lead"
      : "ไม่ติ๊กก็บันทึกคำขอติดต่อกลับได้ · คำตอบจะบันทึกเฉพาะเมื่อลูกค้ายินยอม"}</p>
  </>;
}

export function ConsentFields() {
  return <section className={formCardClass} aria-labelledby="confirm-title">
    <h2 id="confirm-title">ยืนยันก่อนบันทึก</h2>
    <div className="flex flex-col gap-2">
      <label className={walkinOptionClass}><input type="checkbox" name="intake_confirmed" required />
        <span className="flex flex-col gap-2"><span>{PRIVACY_NOTICE.choices.notice_presented}</span><span>{PRIVACY_NOTICE.choices.followup_requested}</span></span></label>
    </div>
    <p className={formHintClass}>การยินยอมให้ใช้คำตอบแบบสอบถามไม่บังคับ ไม่ติ๊กก็บันทึกคำขอติดต่อกลับได้ · <NoticeLink label="อ่านประกาศความเป็นส่วนตัว" /></p>
  </section>;
}
