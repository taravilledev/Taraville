import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { LEAD_COLUMNS, leadSchema, staffSchema } from "./models";
import { privacyEventSchema } from "./privacy";

export async function leadDetail(id: string) {
  const session = await requireStaff();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await session.supabase.from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("โหลดรายการไม่ได้ กรุณาลองใหม่");
  if (!data) notFound();
  const events = await session.supabase.from("lead_privacy_events")
    .select("id,kind,survey_consent,notice_presented,followup_requested,notice_version,notice_hash,recorded_at,actor_id")
    .eq("lead_id", id).order("id", { ascending: false });
  if (events.error) throw new Error("โหลดหลักฐานไม่ได้ กรุณาลองใหม่");
  return { ...session, lead: leadSchema.parse(data), events: privacyEventSchema.array().parse(events.data) };
}

export async function saleOwners(session: Awaited<ReturnType<typeof requireStaff>>) {
  if (session.staff.role !== "executive") return [];
  const { data, error } = await session.supabase.from("staff").select("id,full_name,role,is_active")
    .eq("role", "sale").eq("is_active", true).order("full_name");
  if (error) throw new Error("โหลดรายชื่อผู้ดูแลไม่ได้ กรุณาลองใหม่");
  return staffSchema.array().parse(data);
}

/** Who closed the lead and the free-text reason; Sale cannot read other staff, so the name can be absent. */
export async function closeInfo(session: Awaited<ReturnType<typeof leadDetail>>) {
  const { lead, supabase } = session;
  if (!lead.closed_at || !lead.closed_by) return null;
  const [event, closer] = await Promise.all([
    supabase.from("lead_status_events").select("reason_text").eq("lead_id", lead.id).eq("kind", "close")
      .order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("staff").select("full_name").eq("id", lead.closed_by).maybeSingle(),
  ]);
  if (event.error || closer.error) throw new Error("โหลดข้อมูลการปิดไม่ได้ กรุณาลองใหม่");
  return { text: (event.data?.reason_text as string | null) ?? null, by: (closer.data?.full_name as string | undefined) ?? null };
}
