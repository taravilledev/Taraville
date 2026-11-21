import { PHONE_HINT, PHONE_PATTERN } from "@/lib/walkin/phone";
import type { Lead, Staff } from "@/lib/walkin/models";
import { RequiredMark } from "./required-mark";
import { formCardClass, sectionHeadingClass } from "@/components/form-card";
import { walkinFieldClass } from "./walkin-form-styles";
import { NativeSelect } from "@/components/ui/native-select";

export type ContactErrors = Partial<Record<"first_name" | "phone" | "owner_id", string>>;

const errorClass = "text-xs font-normal text-danger-ink";

// isStepped: the walk-in steps validate before moving on, and a required field hidden on another step would block the final submit silently.
export function ContactFields({ lead, staff, owners, errors = {}, isStepped = false }: {
  lead?: Lead; staff: Staff; owners: Staff[]; errors?: ContactErrors; isStepped?: boolean;
}) {
  return <section id="contact" className={formCardClass} aria-labelledby="contact-title">
    <div className={sectionHeadingClass}><h2 id="contact-title">ข้อมูลติดต่อ</h2><span>ช่องที่มี<RequiredMark />เป็นข้อมูลจำเป็น</span></div>
    <div className="grid grid-cols-[125px_1fr_1fr] gap-4 max-[640px]:grid-cols-1">
      <label data-slot="walkin-field" className={walkinFieldClass}>คำนำหน้า<NativeSelect wrapperClassName="w-full" className="pr-9!" name="name_title" defaultValue={lead?.name_title ?? ""} autoComplete="honorific-prefix">
        <option value="">ไม่ระบุ</option><option>นาย</option><option>นาง</option><option>นางสาว</option>
      </NativeSelect></label>
      <label data-slot="walkin-field" className={walkinFieldClass}><span>ชื่อ<RequiredMark /></span><input name="first_name" defaultValue={lead?.first_name} autoComplete="given-name" required={!isStepped} maxLength={200}
        aria-invalid={errors.first_name ? true : undefined} aria-describedby={errors.first_name ? "lead-first-name-error" : undefined} />
        {errors.first_name && <small id="lead-first-name-error" className={errorClass}>{errors.first_name}</small>}</label>
      <label data-slot="walkin-field" className={walkinFieldClass}>นามสกุล<input name="last_name" defaultValue={lead?.last_name} autoComplete="family-name" maxLength={200} /></label>
    </div>
    <div className="my-6 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      <label data-slot="walkin-field" className={walkinFieldClass}><span>เบอร์โทรศัพท์มือถือ<RequiredMark /></span><input name="phone" type="tel" inputMode="tel" defaultValue={lead?.phone} autoComplete="tel" required={!isStepped} maxLength={80}
        pattern={isStepped ? undefined : PHONE_PATTERN} title={PHONE_HINT} aria-invalid={errors.phone ? true : undefined}
        aria-describedby={errors.phone ? "lead-phone-hint lead-phone-error" : "lead-phone-hint"} />
        <small id="lead-phone-hint">{PHONE_HINT}</small>
        {errors.phone && <small id="lead-phone-error" className={errorClass}>{errors.phone}</small>}</label>
      <label data-slot="walkin-field" className={walkinFieldClass}>LINE ID<input name="line_id" defaultValue={lead?.line_id} autoComplete="off" maxLength={200} /></label>
    </div>
    {!lead && staff.role === "executive" ? <label data-slot="walkin-field" className={walkinFieldClass}><span>ฝ่ายขายผู้ดูแล<RequiredMark /></span>
      <NativeSelect wrapperClassName="w-full" className="pr-9!" name="owner_id" required={!isStepped} defaultValue="" aria-invalid={errors.owner_id ? true : undefined}
        aria-describedby={errors.owner_id ? "lead-owner-error" : undefined}><option value="">เลือกฝ่ายขาย</option>
        {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
      </NativeSelect>{errors.owner_id && <small id="lead-owner-error" className={errorClass}>{errors.owner_id}</small>}</label>
      : <input type="hidden" name="owner_id" value={lead?.owner_id ?? staff.id} />}
  </section>;
}
