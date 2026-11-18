import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/app/walkin/app-shell";
import type { SalesBootstrap } from "@/lib/sales/models";
import sales from "../sales.module.css";
import styles from "./settings.module.css";

const root = "/sales/settings";
export const settingsSections = [
  { id: "catalog", href: root + "/catalog", title: "โครงการและบ้าน/แปลง", description: "ทะเบียนโครงการธาราวิลล์ แบบบ้าน ราคาทะเบียน และสถานะแปลง" },
  { id: "permissions", href: root + "/permissions", title: "จัดสิทธิ์งานและการเงิน", description: "ดูและกำหนดสิทธิ์ทำงานของพนักงานแต่ละคน" },
  { id: "issuers", href: root + "/issuers", title: "บริษัทผู้ออกเอกสาร", description: "ข้อมูลนิติบุคคลและข้อความสัญญาแยกตามแบรนด์" },
] as const;

export function visibleSettings(workspace: SalesBootstrap) {
  return settingsSections.filter(({ id }) => id === "catalog"
    ? workspace.can_catalog || workspace.developments.length > 0 : workspace.can_admin);
}

export type SettingsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export function SettingsShell({ staff, workspace, section, title, description, back, actions, children }: {
  staff: ComponentProps<typeof AppShell>["staff"];
  workspace: SalesBootstrap;
  section?: typeof settingsSections[number]["id"];
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
}) {
  const sections = visibleSettings(workspace);
  const returnLink = back ?? (section ? { href: root, label: "ตั้งค่างานขาย" } : { href: "/dashboard", label: "แดชบอร์ด" });
  return <AppShell staff={staff} wide><div className={styles.workspace}>
    <aside className={styles.sidebar}>
      <nav aria-label="ตั้งค่างานขาย">
        <Link href={root} prefetch={false} aria-current={!section ? "page" : undefined}>ตั้งค่างานขาย</Link>
        {sections.map(item => <Link key={item.id} href={item.href} prefetch={false} aria-current={section === item.id ? (back ? "location" : "page") : undefined}>{item.title}</Link>)}
      </nav>
    </aside>
    <div className={styles.content}>
      <header className={styles.header}>
        <Link className={sales.muted} href={returnLink.href} prefetch={false}>← {returnLink.label}</Link>
        <div className={styles.titleRow}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}</div>
      </header>
      {children}
    </div>
  </div></AppShell>;
}

export function SettingsLinks({ items }: { items: { href: string; title: string; description: string }[] }) {
  return <ul className={styles.cards}>{items.map(item => <li key={item.href}>
    <Link href={item.href} prefetch={false}><strong>{item.title}</strong><span>{item.description}</span></Link>
  </li>)}</ul>;
}
