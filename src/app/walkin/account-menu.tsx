"use client";

import { accountMenuClass } from "@/components/app-shell-styles";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ChevronDown, Lock, LogOut } from "lucide-react";
import type { Staff } from "@/lib/walkin/models";
import { logout } from "@/app/login/actions";

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
  return <details ref={menu} className="group/account relative ml-auto">
    <summary className="flex min-h-(--tap-min) cursor-pointer list-none items-center gap-3 rounded-full border bg-card py-1 pr-3 pl-1 group-open/account:border-primary max-[640px]:gap-2 max-[640px]:pr-2 [&::-webkit-details-marker]:hidden [&>svg]:text-muted-foreground group-open/account:[&>svg]:rotate-180 motion-safe:[&>svg]:transition-transform motion-safe:[&>svg]:duration-150" aria-label={`เมนูบัญชี ${staff.full_name} · ${staff.role === "sale" ? "ฝ่ายขาย" : "ผู้บริหาร"}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-md/[normal] font-bold text-primary [font-family:var(--font-utility)]" aria-hidden="true">{Array.from(staff.full_name)[0]?.toUpperCase()}</span>
      <span className="flex flex-col text-left leading-[1.35] [&_strong]:text-sm/[1.35] [&_small]:text-xs/[1.35] [&_small]:text-muted-foreground max-[640px]:hidden"><strong>{staff.full_name}</strong><small>{staff.role === "sale" ? "ฝ่ายขาย" : "ผู้บริหาร"}</small></span>
      <ChevronDown aria-hidden="true" />
    </summary>
    <div className={accountMenuClass}>
      <Link href="/account/password" prefetch={false}><Lock aria-hidden="true" />เปลี่ยนรหัสผ่าน</Link>
      <form action={logout}><LogoutButton /></form>
    </div>
  </details>;
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return <button className="[&&]:text-destructive [&&_svg]:text-destructive" disabled={pending}><LogOut aria-hidden="true" />{pending ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button>;
}
