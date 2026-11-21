import { shellClass, shellFooterClass, shellMainClass } from "@/components/app-shell-styles";
import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { navItems } from "@/lib/nav";
import type { Staff } from "@/lib/walkin/models";
import { AppSidebar, SidebarSkeleton } from "./app-sidebar";
import { CloseFocusLink } from "./close-focus-link";
import { LEAD_FORM_ID } from "./lead-form";

const SKIP_LINK = <a className="absolute inset-s-3 inset-bs-3 z-[25] rounded-sm bg-card px-3 py-2 text-primary not-focus:sr-only" href="#main-content">ข้ามไปเนื้อหาหลัก</a>;
const GROUP_NAME = <strong className="text-sm font-bold [font-family:var(--font-utility)]">Taraville Group</strong>;

// No staff: signed-out pages. focus: a single task (walk-in form) without navigation. Otherwise: sidebar + content.
// isLoading: the streaming fallback of a sidebar page, before staff is known.
export function AppShell({ children, staff, wide, focus, isLoading }: { children: ReactNode; staff?: Staff; wide?: boolean; focus?: boolean; isLoading?: boolean }) {
  const main = <main id="main-content" tabIndex={-1} className={wide ? `${shellMainClass} min-[1024px]:w-[min(100%-80px,1280px)] min-[1180px]:w-[min(100%-80px,1280px)]` : shellMainClass}>{children}</main>;
  const footer = <footer className={shellFooterClass}>Taraville Group · ธาราวิลล์ · บ้านคุณภาพ © 2026</footer>;
  if ((staff || isLoading) && !focus) return <div data-slot="app-shell" className={`${shellClass} md:flex-row dense`} lang="th">
    {SKIP_LINK}
    {staff ? <AppSidebar items={navItems(staff.role)} staff={staff} /> : <SidebarSkeleton />}
    <div className="flex min-w-0 flex-1 flex-col">{main}{footer}</div>
  </div>;
  return <div data-slot="app-shell" className={`${shellClass} dense`} lang="th">
    {SKIP_LINK}
    <header className="flex min-h-14 items-center gap-3 border-b bg-card px-[max(1rem,calc((100vw-1280px)/2))] py-1">
      {focus ? <><CloseFocusLink formId={LEAD_FORM_ID} />{GROUP_NAME}</>
        : <a href="/dashboard" className="inline-flex min-h-(--tap-min) items-center gap-3 text-foreground no-underline">
          <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground" aria-hidden="true"><Building2 size={18} /></span>
          <span className="flex flex-col leading-[1.25] [&_strong]:font-bold [&_strong]:text-sm/[normal] [&_strong]:[font-family:var(--font-utility)] [&_small]:text-xs/[1.25] [&_small]:text-muted-foreground max-[640px]:[&_small]:hidden"><strong>Taraville Group</strong><small>ธาราวิลล์ · บ้านคุณภาพ</small></span>
        </a>}
    </header>
    {main}{footer}
  </div>;
}
