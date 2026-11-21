import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { caseWork } from "./case-work";
import { bootstrapSchema, caseDetailSchema, caseListRowSchema, workQueueSchema } from "./models";

export async function salesBootstrap() {
  const session = await requireStaff();
  const { data, error } = await session.supabase.rpc("sales_bootstrap");
  if (error) throw new Error("โหลดรายการงานไม่ได้ กรุณาลองใหม่");
  return { ...session, workspace: bootstrapSchema.parse(data) };
}

export async function salesCase(id: string) {
  const session = await requireStaff();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await session.supabase.rpc("sales_case_detail", { p_case_id: id });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("โหลดข้อมูลงานไม่ได้ กรุณาลองใหม่");
  return { ...session, sale: caseDetailSchema.parse(data) };
}

export async function salesWorkQueue() {
  const session = await requireStaff();
  const { data, error } = await session.supabase.rpc("sales_work_queue");
  const parsed = error ? null : workQueueSchema.safeParse(data);
  return parsed?.success ? parsed.data : null; // null: the list below still works, the queue shows a notice
}

export async function salesCaseList(filters: { status: string; brand: string; query: string }) {
  const session = await requireStaff();
  const { data, error } = await session.supabase.rpc("sales_case_list", {
    p_status: filters.status, p_brand: filters.brand || null, p_query: filters.query || null });
  if (error) throw new Error("โหลดรายการงานไม่ได้ กรุณาลองใหม่");
  // work is null without financial.view, matching the case page, which shows no next step then either.
  return caseListRowSchema.array().parse(data).map(row => ({
    ...row, work: row.facts && row.permissions ? caseWork(row, row.facts, row.permissions) : null }));
}
