"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ChevronDown, Lock, LogOut } from "lucide-react";
import type { Staff } from "@/lib/walkin/models";
import { logout } from "@/app/login/actions";
import styles from "./walkin.module.css";

export function AccountMenu({ staff }: { staff: Staff }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = () => menu.current?.removeAttribute("open");
    const onPointer = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, []);
  return <details ref={menu} className={styles.account}>
    <summary className={styles.accountTrigger}>
      <span className={styles.avatar} aria-hidden="true">{Array.from(staff.full_name)[0]?.toUpperCase()}</span>
      <span className={styles.accountName}><strong>{staff.full_name}</strong><small>{staff.role === "sale" ? "ฝ่ายขาย" : "ผู้บริหาร"}</small></span>
      <ChevronDown aria-hidden="true" />
    </summary>
    <div className={styles.accountMenu}>
      <Link href="/account/password" prefetch={false}><Lock aria-hidden="true" />เปลี่ยนรหัสผ่าน</Link>
      <form action={logout}><LogoutButton /></form>
    </div>
  </details>;
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return <button className={styles.menuDanger} disabled={pending}><LogOut aria-hidden="true" />{pending ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button>;
}
