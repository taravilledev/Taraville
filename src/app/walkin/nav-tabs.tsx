"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Users, UserPlus } from "lucide-react";

const TABS = [{ href: "/walkin", label: "รับลูกค้า", Icon: UserPlus }, { href: "/leads", label: "รายการ", Icon: Users }, { href: "/dashboard", label: "แดชบอร์ด", Icon: BriefcaseBusiness }];

export function NavTabs() {
  const pathname = usePathname();
  return <nav className="ms-2 flex gap-1 [&_a]:inline-flex [&_a]:min-h-(--tap-min) [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-sm [&_a]:px-3 [&_a]:text-sm [&_a]:font-semibold [&_a]:text-muted-foreground [&_a]:no-underline [&_a[aria-current]]:bg-muted [&_a[aria-current]]:text-foreground" aria-label="เมนูหลัก">
    {TABS.map(tab => <Link key={tab.href} href={tab.href} prefetch={false} aria-current={pathname.startsWith(tab.href) ? "page" : tab.href === "/dashboard" && (pathname.startsWith("/sales/") || pathname === "/summary") ? "location" : undefined}><tab.Icon size={16} aria-hidden="true" />{tab.label}</Link>)}
  </nav>;
}
