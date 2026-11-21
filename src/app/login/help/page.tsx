import { AuthShell } from "../auth-shell";
import { Button } from "@/components/ui/button";

export const metadata = { title: "ลืมรหัสผ่าน · Taraville Group", robots: { index: false, follow: false } };
export default function PasswordHelpPage() {
  return <AuthShell>
    <h1>ลืมรหัสผ่าน</h1>
    <p>ระบบนี้ยังไม่ส่งลิงก์กู้คืนทางอีเมล ให้ติดต่อ Support ทาง LINE พร้อมแจ้งชื่อผู้ใช้และชื่อของคุณ</p>
    <div className="flex flex-col gap-1 rounded-sm bg-muted p-4 text-sm">
      <span className="text-xs font-semibold text-primary">ติดต่อ</span>
      <strong>Support</strong>
      <span className="text-muted-foreground">LINE · art</span>
    </div>
    <ol>
      <li>Support ตรวจว่าเป็นคุณจริง</li>
      <li>คุณได้รับรหัสชั่วคราวทางช่องทางส่วนตัว</li>
      <li>เข้าสู่ระบบ แล้วเลือก “เปลี่ยนรหัสผ่าน” ที่เมนูด้านข้าง</li>
      <li>ใส่รหัสชั่วคราวเป็นรหัสปัจจุบัน แล้วตั้งรหัสใหม่</li>
    </ol>
    <p role="note" className="rounded-sm bg-muted p-3 text-sm">อย่าส่งรหัสผ่านในแชตกลุ่มหรือที่สาธารณะ</p>
    <Button asChild size="auto" className="min-h-(--control-h) px-6 text-sm font-bold no-underline">
      <a href="/login">กลับหน้าเข้าสู่ระบบ</a>
    </Button>
  </AuthShell>;
}
