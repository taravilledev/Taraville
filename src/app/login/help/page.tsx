import { AppShell } from "@/app/walkin/app-shell";
import styles from "@/app/walkin/walkin.module.css";

export const metadata = { title: "ลืมรหัสผ่าน · Taraville Group", robots: { index: false, follow: false } };
export default function PasswordHelpPage() {
  return <AppShell><section className={styles.card}>
    <h1>ลืมรหัสผ่าน</h1>
    <p>ติดต่อผู้ดูแลระบบของบริษัทผ่านช่องทางที่บริษัทใช้อยู่ แจ้งชื่อผู้ใช้และชื่อของคุณเพื่อให้ผู้ดูแลตรวจสอบตัวตน</p>
    <ol>
      <li>ผู้ดูแลยืนยันตัวตนและสิทธิ์ของคุณก่อนรีเซ็ต</li>
      <li>รับรหัสชั่วคราวจากผู้ดูแลเป็นการส่วนตัว โดยใช้ชื่อผู้ใช้เดิม</li>
      <li>เข้าสู่ระบบ แล้วเลือกเมนู “ตั้ง / เปลี่ยนรหัสผ่าน”</li>
      <li>กรอกรหัสชั่วคราวในช่องรหัสปัจจุบัน แล้วตั้งรหัสใหม่ด้วยตนเอง</li>
    </ol>
    <p>ไม่ต้องแจ้งรหัสเดิมหรือรหัสใหม่ให้ผู้ดูแล และไม่ส่งรหัสผ่านในแชตหรือกลุ่มงาน</p>
    <p>ระบบนี้ยังไม่ส่งลิงก์กู้คืนทางอีเมล หากไม่มีผู้ดูแลที่ได้รับมอบหมาย ให้ติดต่อผู้รับผิดชอบระบบของบริษัทก่อน</p>
    <a className={styles.primaryLink} href="/login">กลับหน้าเข้าสู่ระบบ</a>
  </section></AppShell>;
}
