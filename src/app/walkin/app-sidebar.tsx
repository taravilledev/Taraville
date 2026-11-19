"use client";

import { useEffect, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { BriefcaseBusiness, ChartColumn, House, LayoutDashboard, Lock, LogOut, Menu, SlidersHorizontal, UserPlus, Users, Wallet } from "lucide-react";
import { BrandMark } from "@/components/brand-tag";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { logout } from "@/app/login/actions";
import { activeHref, type NavIcon, type NavItem } from "@/lib/nav";
import type { Staff } from "@/lib/walkin/models";

const ICONS: Record<NavIcon, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  home: House, overview: LayoutDashboard, walkin: UserPlus, leads: Users,
  projects: BriefcaseBusiness, finance: Wallet, report: ChartColumn, settings: SlidersHorizontal,
};
const ROLE_LABEL = { sale: "ฝ่ายขาย", executive: "ผู้บริหาร" } as const;
// Rail (768–1179px) hides the text visually; the full sidebar (≥1180px) and the drawer show it.
const RAIL_LABEL = "sr-only min-[1180px]:not-sr-only";
const ROW = "flex min-h-(--tap-min) items-center gap-3 rounded-sm px-3 text-sm text-muted-foreground no-underline hover:bg-muted max-[1179px]:md:justify-center max-[1179px]:md:px-0";

function GroupMark({ labelClass }: { labelClass: string }) {
  return <Link href="/dashboard" prefetch={false} className="flex min-h-(--tap-min) items-center gap-3 px-3 text-foreground no-underline max-[1179px]:md:justify-center max-[1179px]:md:px-0">
    <span className="flex shrink-0 gap-1"><BrandMark brand="BAAN_KUNAPAP" /><BrandMark brand="TARAVILLE" /></span>
    <span className={`flex flex-col leading-[1.25] ${labelClass}`}><strong className="text-sm [font-family:var(--font-utility)]">Taraville Group</strong><small className="text-xs text-muted-foreground">บ้านคุณภาพ · ธาราวิลล์</small></span>
  </Link>;
}

function SidebarBody({ items, staff, labelClass }: { items: NavItem[]; staff: Staff; labelClass: string }) {
  const active = activeHref(usePathname(), items);
  const role = ROLE_LABEL[staff.role];
  return <>
    <GroupMark labelClass={labelClass} />
    <nav aria-label="เมนูหลัก" className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon }) => {
        const Icon = ICONS[icon];
        const isActive = href === active;
        return <Link key={href} href={href} prefetch={false} title={label} aria-current={isActive ? "page" : undefined} className={`${ROW} ${isActive ? "bg-primary-tint font-semibold text-primary" : ""}`}>
          <Icon size={20} aria-hidden /><span className={labelClass}>{label}</span>
        </Link>;
      })}
    </nav>
    <div className="flex flex-col gap-1 border-t pt-3">
      <div className="flex min-h-(--tap-min) items-center gap-3 px-3 max-[1179px]:md:justify-center max-[1179px]:md:px-0" title={`${staff.full_name} · ${role}`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-md/[normal] font-bold text-primary [font-family:var(--font-utility)]" aria-hidden="true">{Array.from(staff.full_name)[0]?.toUpperCase()}</span>
        <span className={`flex min-w-0 flex-col leading-[1.35] ${labelClass}`}><strong className="truncate text-sm">{staff.full_name}</strong><small className="text-xs text-muted-foreground">{role}</small></span>
      </div>
      <Link href="/account/password" prefetch={false} title="เปลี่ยนรหัสผ่าน" className={ROW}><Lock size={20} aria-hidden /><span className={labelClass}>เปลี่ยนรหัสผ่าน</span></Link>
      <form action={logout}><LogoutButton labelClass={labelClass} /></form>
    </div>
  </>;
}

function LogoutButton({ labelClass }: { labelClass: string }) {
  const { pending } = useFormStatus();
  const label = pending ? "กำลังออกจากระบบ…" : "ออกจากระบบ";
  return <button title="ออกจากระบบ" disabled={pending} className={`${ROW} w-full cursor-pointer border-0 bg-transparent text-destructive [font:inherit]`}><LogOut size={20} aria-hidden /><span className={labelClass}>{label}</span></button>;
}

export function AppSidebar({ items, staff }: { items: NavItem[]; staff: Staff }) {
  // The drawer is md:hidden but stays modal if the screen widens (phone rotated), which would block the whole page.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const close = () => { if (wide.matches) document.querySelector<HTMLDialogElement>("dialog[data-nav-drawer][open]")?.close(); };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);
  return <>
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col gap-3 overflow-y-auto border-r bg-card p-2 md:flex min-[1180px]:w-62 print:hidden">
      <SidebarBody items={items} staff={staff} labelClass={RAIL_LABEL} />
    </aside>
    <Dialog>
      <header className="flex min-h-14 items-center justify-between border-b bg-card px-2 md:hidden print:hidden">
        <GroupMark labelClass="" />
        <DialogTrigger aria-label="เปิดเมนู" className="grid size-(--tap-min) place-items-center rounded-sm text-foreground hover:bg-muted"><Menu size={22} aria-hidden /></DialogTrigger>
      </header>
      <DialogContent title="เมนู" data-nav-drawer="" className="m-0 mr-auto h-dvh max-h-dvh w-[min(20rem,85vw)] rounded-none border-y-0 border-l-0 md:hidden"
        // Replaces the wrapper's backdrop handler, so it closes on a backdrop click too, and after a link click on the same route.
        onClick={event => { if (event.target === event.currentTarget || (event.target instanceof Element && event.target.closest("a"))) event.currentTarget.close(); }}>
        <div className="flex flex-col gap-3"><SidebarBody items={items} staff={staff} labelClass="" /></div>
      </DialogContent>
    </Dialog>
  </>;
}
