"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./walkin.module.css";

const TABS = [{ href: "/walkin", label: "รับลูกค้า" }, { href: "/leads", label: "รายการ" }];

export function NavTabs() {
  const pathname = usePathname();
  return <nav className={styles.tabs} aria-label="เมนูหลัก">
    {TABS.map(tab => <Link key={tab.href} href={tab.href} prefetch={false} aria-current={pathname.startsWith(tab.href) ? "page" : undefined}>{tab.label}</Link>)}
  </nav>;
}
