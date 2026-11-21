import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/app/walkin/app-shell";
import type { SalesBootstrap } from "@/lib/sales/models";
import { tabLinksClass } from "@/components/tab-links";
import { cn } from "@/lib/utils";
import * as ui from "./settings-styles";

const root = "/sales/settings";
export const settingsSections = [
  { id: "catalog", href: root + "/catalog", title: "โครงการและบ้าน/แปลง", description: "ทะเบียนโครงการธาราวิลล์ แบบบ้าน ราคาทะเบียน และสถานะแปลง" },
  { id: "permissions", href: root + "/permissions", title: "สิทธิ์พนักงาน", description: "ดูและกำหนดสิทธิ์ทำงานของพนักงานแต่ละคน" },
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
  const returnLink = back ?? (section ? undefined : { href: "/dashboard", label: "แดชบอร์ด" });
  return <AppShell staff={staff} wide><div className={ui.contentClass}>
    <header className={ui.headerClass}>
      {returnLink && <Link className={cn("justify-self-start text-sm text-muted-foreground underline-offset-[.2em]", ui.focusRingClass)} href={returnLink.href} prefetch={false}>← {returnLink.label}</Link>}
      <div className={ui.titleRowClass}><div><h1 className="m-0 text-title/[1.3] font-bold">{title}</h1>{description && <p className="mt-2 mb-0 text-muted-foreground">{description}</p>}</div>{actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}</div>
    </header>
    {sections.length > 0 && <nav className={tabLinksClass} aria-label="หมวดตั้งค่า">
      {sections.map(item => <Link key={item.id} href={item.href} prefetch={false} aria-current={section === item.id ? "page" : undefined}>{item.title}</Link>)}
    </nav>}
    {children}
  </div></AppShell>;
}

export function SettingsLinks({ items }: { items: { href: string; title: string; description: string }[] }) {
  return <ul className={ui.cardListClass}>{items.map(item => <li key={item.href}>
    <Link href={item.href} prefetch={false} className={ui.cardLinkClass}><strong>{item.title}</strong><span>{item.description}</span></Link>
  </li>)}</ul>;
}
