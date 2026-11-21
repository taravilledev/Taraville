// Supabase Auth gives one code for a wrong username and a wrong password (verified on the local stack:
// `invalid_credentials`), so they share one message and the form never reveals which accounts exist.
export function loginErrorMessage(error: { code?: string; status?: number; name?: string }) {
  if (error.code === "invalid_credentials") return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง · ตรวจตัวพิมพ์เล็ก-ใหญ่ หรือกด “แสดง” เพื่อดูรหัสที่พิมพ์";
  if (error.code === "over_request_rate_limit" || error.status === 429) return "ลองผิดหลายครั้งเกินไป · รอสักครู่แล้วลองใหม่ หรือกด “ลืมรหัสผ่าน”";
  if (error.name === "AuthRetryableFetchError") return "เชื่อมต่อระบบไม่ได้ · ตรวจอินเทอร์เน็ตแล้วลองใหม่";
  return "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจชื่อผู้ใช้และรหัสผ่าน หรือลองใหม่ภายหลัง";
}
