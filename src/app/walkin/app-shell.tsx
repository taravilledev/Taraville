import type { ReactNode } from "react";
import Link from "next/link";
import type { Staff } from "@/lib/walkin/models";
import { logout } from "@/app/login/actions";
import { palettes } from "./palette-options";
import { previewFonts } from "./preview-fonts";
import styles from "./walkin.module.css";

export function AppShell({ children, staff, paletteId, fontId }: { children: ReactNode; staff?: Staff; paletteId?: string; fontId?: string }) {
  const palette = palettes.find(option => option.id === paletteId) ?? palettes.find(option => option.id === "peach");
  return <div className={`${styles.shell} ${previewFonts}`} lang="th" data-font={fontId === "friendly" ? "friendly" : "humanist"}
    style={palette?.colors}>
    <header className={styles.header}>
      <a href="/walkin" className={styles.wordmark}>TARAVILLE <span className={styles.wordmarkLight}>GROUP</span></a>
      {staff && <div className={styles.account}><span>{staff.full_name} · {staff.role === "sale" ? "ฝ่ายขาย" : "ผู้บริหาร"}</span>
        <form action={logout}><button className={styles.linkButton}>ออกจากระบบ</button></form>
      </div>}
    </header>
    <main className={styles.main}>
      <div className={styles.previewNote} role="note"><strong>ทดสอบระบบ · ใช้ข้อมูลสมมติเท่านั้น</strong>
        <span>ยังไม่เปิดรับข้อมูลลูกค้าจริง ระหว่างรออนุมัติประกาศความเป็นส่วนตัว</span></div>
      {staff && <nav className={styles.sectionNav}><a href="/walkin">รับข้อมูลใหม่</a><Link href="/leads" prefetch={false}>รายการผู้สนใจ</Link><Link href="/account/password" prefetch={false}>ตั้ง / เปลี่ยนรหัสผ่าน</Link></nav>}
      <div className={styles.content}>{children}</div>
    </main>
  </div>;
}
