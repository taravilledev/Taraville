"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main lang="th" style={{ padding: 32 }}><h1>เปิดหน้านี้ไม่สำเร็จ</h1>
    <p>กรุณาลองใหม่ หากยังไม่ได้ให้ติดต่อผู้ดูแล</p>
    <button onClick={reset} style={{ minHeight: 48 }}>ลองใหม่</button> <a href="/login">กลับหน้าเข้าสู่ระบบ</a>
  </main>;
}
