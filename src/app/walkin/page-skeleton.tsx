import { skeletonClass, skeletonBlockClass, skeletonTitleClass, skeletonCardClass } from "@/components/page-skeleton-styles";
import type { Staff } from "@/lib/walkin/models";
import { AppShell } from "./app-shell";

// The fallback must use the frame of the page that replaces it, or the old frame flashes while the page streams.
// app: sidebar pages · focus: walk-in · public: signed-out pages · bare: paper documents.
export function PageSkeleton({ staff, layout = "app" }: { staff?: Staff; layout?: "app" | "focus" | "public" | "bare" }) {
  const blocks = <div className={skeletonClass} role="status">
    <span className="sr-only">กำลังโหลด…</span>
    <div className={`${skeletonBlockClass} ${skeletonTitleClass}`} />
    <div className={`${skeletonBlockClass} ${skeletonCardClass}`} />
    <div className={`${skeletonBlockClass} ${skeletonCardClass}`} />
  </div>;
  if (layout === "bare") return <main className="mx-auto w-[min(100%-32px,960px)] py-8">{blocks}</main>;
  return <AppShell staff={staff} focus={layout === "focus"} isLoading={layout === "app"}>{blocks}</AppShell>;
}
