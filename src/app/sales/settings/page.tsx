import { Suspense } from "react";
import { salesBootstrap } from "@/lib/sales/queries";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { SettingsLinks, SettingsShell, visibleSettings } from "./settings-shell";
import styles from "../sales.module.css";

export const metadata = { title: "ตั้งค่างานขาย · Taraville Group", robots: { index: false, follow: false } };
export default function SettingsPage() { return <Suspense fallback={<PageSkeleton />}><Settings /></Suspense>; }

async function Settings() {
  const { staff, workspace } = await salesBootstrap();
  const sections = visibleSettings(workspace);
  return <SettingsShell staff={staff} workspace={workspace} title="ตั้งค่างานขาย">
    {sections.length ? <SettingsLinks items={sections.map(item => ({ ...item }))} />
      : <p className={styles.notice}>คุณไม่มีหัวข้อตั้งค่าที่เปิดได้</p>}
  </SettingsShell>;
}
