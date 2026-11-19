import { skeletonClass, skeletonBlockClass, skeletonTitleClass, skeletonCardClass } from "@/components/page-skeleton-styles";
import type { Staff } from "@/lib/walkin/models";
import { AppShell } from "./app-shell";

export function PageSkeleton({ staff }: { staff?: Staff }) {
  return <AppShell staff={staff}>
    <div className={skeletonClass} role="status">
      <span className="sr-only">กำลังโหลด…</span>
      <div className={`${skeletonBlockClass} ${skeletonTitleClass}`} />
      <div className={`${skeletonBlockClass} ${skeletonCardClass}`} />
      <div className={`${skeletonBlockClass} ${skeletonCardClass}`} />
    </div>
  </AppShell>;
}
