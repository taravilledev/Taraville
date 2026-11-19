import { Suspense } from "react";
import { redirect } from "next/navigation";
import { salesBootstrap } from "@/lib/sales/queries";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { Primitives } from "./primitives";

export const metadata = { title: "Design system · Taraville Group", robots: { index: false, follow: false } };

// Class names are literal strings so Tailwind can see them.
const colours = [
  ["background", "bg-background"], ["card", "bg-card"], ["primary", "bg-primary"], ["secondary / muted / accent", "bg-secondary"],
  ["destructive", "bg-destructive"], ["border", "bg-border"], ["input", "bg-input"], ["brand-tv", "bg-brand-tv"],
  ["brand-tv-tint", "bg-brand-tv-tint"], ["brand-bk", "bg-brand-bk"], ["brand-bk-tint", "bg-brand-bk-tint"],
  ["warn-tint", "bg-warn-tint"], ["danger-tint", "bg-danger-tint"],
] as const;
const textSizes = [["text-xs", "text-xs"], ["text-sm", "text-sm"], ["text-md", "text-md"], ["text-lg", "text-lg"], ["text-xl", "text-xl"], ["text-title", "text-title"]] as const;
const radii = [["rounded-sm", "rounded-sm"], ["rounded-md", "rounded-md"], ["rounded-lg", "rounded-lg"], ["rounded-full", "rounded-full"]] as const;

export default function DesignSystemPage() {
  return <Suspense fallback={<PageSkeleton />}><DesignSystem /></Suspense>;
}

async function DesignSystem() {
  const { staff, workspace } = await salesBootstrap();
  if (!workspace.can_admin) redirect("/dashboard");
  return <AppShell staff={staff} wide>
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold">Design system</h1>
        <p className="text-muted-foreground">ADR 0031. ส่วนประกอบพื้นฐานและส่วนประกอบร่วมของแอป</p>
      </header>

      <Section title="สี (semantic tokens)">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {colours.map(([name, swatch]) => <li key={name} className="flex items-center gap-3 rounded-md border bg-card p-3">
            <span className={`${swatch} size-8 shrink-0 rounded-sm border`} aria-hidden="true" />
            <span className="text-sm">{name}</span>
          </li>)}
        </ul>
      </Section>

      <Section title="ขนาดตัวอักษร (เปลี่ยนตาม density)">
        <ul className="flex flex-col gap-2 rounded-md border bg-card p-4">
          {textSizes.map(([name, size]) => <li key={name} className={size}>{name} · ธาราวิล · บ้านคุณภาพ Taraville 0123456789</li>)}
        </ul>
      </Section>

      <Section title="ความสูง control (--control-h)">
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-4">
          <div className="flex h-(--control-h) items-center rounded-md border border-input px-3 text-md">ช่องกรอก</div>
          <div className="flex h-(--control-h) items-center rounded-md bg-primary px-4 text-md text-primary-foreground">ปุ่มหลัก</div>
          <p className="text-sm text-muted-foreground">เมาส์ 36px · จอสัมผัส 44px</p>
        </div>
      </Section>

      <Section title="มุมโค้ง">
        <ul className="flex flex-wrap gap-3">
          {radii.map(([name, radius]) => <li key={name} className={`${radius} flex h-16 w-28 items-center justify-center border bg-card text-sm`}>{name}</li>)}
        </ul>
      </Section>

      <Primitives />
    </div>
  </AppShell>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-3" aria-label={title}>
    <h2 className="text-lg font-bold">{title}</h2>
    {children}
  </section>;
}
