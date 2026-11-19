export const PHONE_PATTERN = String.raw`\+?(?:[0-9][ .\-]*){6,14}[0-9]`;
export const PHONE_HINT = "กรอกเบอร์โทร 7–15 หลัก ใช้ + นำหน้าเบอร์ต่างประเทศได้";

export function dialablePhone(value: string) {
  const phone = value.trim();
  return new RegExp(`^(?:${PHONE_PATTERN})$`).test(phone) ? phone.replace(/[ .-]/g, "") : null;
}
