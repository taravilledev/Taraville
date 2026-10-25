"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UserPlus } from "lucide-react";
import styles from "./walkin.module.css";

const TABS = [{ href: "/walkin", label: "รับลูกค้า", Icon: UserPlus }, { href: "/leads", label: "รายการ", Icon: Users }];

export function NavTabs() {
  const pathname = usePathname();
  return <nav className={styles.tabs} aria-label="เมนูหลัก">
    {TABS.map(tab => <Link key={tab.href} href={tab.href} prefetch={false} aria-current={pathname.startsWith(tab.href) ? "page" : undefined}><tab.Icon size={16} aria-hidden="true" />{tab.label}</Link>)}
  </nav>;
}
