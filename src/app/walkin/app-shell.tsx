import { shellClass, shellFooterClass, shellMainClass } from "@/components/app-shell-styles";
import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import type { Staff } from "@/lib/walkin/models";
import { AccountMenu } from "./account-menu";
import { NavTabs } from "./nav-tabs";

export function AppShell({ children, staff, wide }: { children: ReactNode; staff?: Staff; wide?: boolean }) {
  return <div data-slot="app-shell" className={`${shellClass} dense`} lang="th">
    <a className="absolute inset-s-3 inset-bs-3 z-[25] rounded-sm bg-card px-3 py-2 text-primary not-focus:sr-only" href="#main-content">ข้ามไปเนื้อหาหลัก</a>
    <header className="flex min-h-14 flex-wrap items-center gap-4 border-b bg-card px-[max(1rem,calc((100vw-1280px)/2))] py-1">
      <a href="/walkin" className="inline-flex min-h-(--tap-min) items-center gap-3 text-foreground no-underline">
        <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground" aria-hidden="true"><Building2 size={18} /></span>
        <span className="flex flex-col leading-[1.25] [&_strong]:font-bold [&_strong]:text-sm/[normal] [&_strong]:[font-family:var(--font-utility)] [&_small]:text-xs/[1.25] [&_small]:text-muted-foreground max-[640px]:[&_small]:hidden"><strong>Taraville Group</strong><small>ธาราวิล · บ้านคุณภาพ</small></span>
      </a>
      {staff && <NavTabs />}
      {staff && <AccountMenu staff={staff} />}
    </header>
    <main id="main-content" tabIndex={-1} className={wide ? `${shellMainClass} min-[1024px]:w-[min(100%-80px,1280px)] min-[1180px]:w-[min(100%-80px,1280px)]` : shellMainClass}>{children}</main>
    <footer className={shellFooterClass}>Taraville Group · ธาราวิล · บ้านคุณภาพ © 2026</footer>
  </div>;
}
