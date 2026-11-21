import type { requireStaff } from "@/lib/supabase/staff";
import { PROJECT_COLUMNS, projectSchema } from "@/lib/walkin/models";
import type { SalesCase } from "@/lib/sales/models";
import { noticeClass } from "@/components/notice";
import { CancelProject } from "./project-controls";

/** Bottom of the BKP project page (Executive only): cancel the Project this sale belongs to, while it is still active. */
export async function CancelProjectSection({ supabase, sale }: { supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"]; sale: SalesCase }) {
  if (!sale.project_id) return null;
  const { data, error } = await supabase.from("projects").select(PROJECT_COLUMNS).eq("id", sale.project_id).maybeSingle();
  const project = projectSchema.nullable().safeParse(data);
  if (error || !project.success) return <p className={noticeClass} role="note">โหลดข้อมูลการยกเลิกโครงการไม่ได้ ลองรีเฟรชหน้านี้</p>;
  if (project.data?.status !== "active") return null;
  return <CancelProject leadId={sale.lead_id} project={project.data} openCaseId={sale.status === "cancelled" ? undefined : sale.id} />;
}
