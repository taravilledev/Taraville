import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { LEAD_COLUMNS, PROJECT_COLUMNS, leadSchema, projectSchema, staffSchema } from "./models";
import { privacyEventSchema } from "./privacy";
import { hidesClosed, type LeadFilters } from "./lead-list";

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

/** The list's filters as one query, shared by the list page and the CSV export so both select the same leads. */
export function filteredLeads(session: Awaited<ReturnType<typeof requireStaff>>, filters: LeadFilters) {
  let request = session.supabase.from("walkin_leads_staged").select(`${LEAD_COLUMNS},stage`, { count: "exact" });
  // PostgREST or() syntax reserves these characters; names, phones and LINE IDs never need them.
  for (const term of (filters.q ?? "").replace(/[%,()*\\"]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3)) {
    request = request.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%,line_id.ilike.%${term}%`);
  }
  if (filters.stage) request = request.eq("stage", filters.stage);
  else if (hidesClosed(filters)) request = request.neq("stage", "closed");
  if (filters.brand) request = request.eq("brand", filters.brand);
  if (filters.owner) request = request.eq("owner_id", session.staff.role === "executive" ? filters.owner : session.staff.id);
  if (filters.from) request = request.gte("created_at", `${filters.from}T00:00:00+07:00`);
  if (filters.to) request = request.lte("created_at", `${filters.to}T23:59:59.999999+07:00`);
  const ascending = filters.dir === "asc";
  return filters.sort === "contact" ? request.order("last_contact_at", { ascending, nullsFirst: false }).order("id", { ascending }) : request.order("created_at", { ascending }).order("id", { ascending });
}

/** Lead counts per brand under every other filter, for the brand tiles; brand and page are ignored. */
export async function brandCounts(session: Awaited<ReturnType<typeof requireStaff>>, filters: LeadFilters) {
  const count = async (brand: "TARAVILLE" | "BAAN_KUNAPAP") => {
    const { count, error } = await filteredLeads(session, { ...filters, brand }).range(0, 0);
    if (error) throw new Error("โหลดรายการไม่ได้ กรุณาลองใหม่");
    return count ?? 0;
  };
  const [taraville, baanKunapap] = await Promise.all([count("TARAVILLE"), count("BAAN_KUNAPAP")]);
  return { all: taraville + baanKunapap, taraville, baanKunapap };
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

/** Projects of a lead, newest first, with the names of whoever cancelled them (Sale may not read other staff). */
export async function leadProjects(session: Awaited<ReturnType<typeof leadDetail>>) {
  const { lead, supabase } = session;
  const { data, error } = await supabase.from("projects").select(PROJECT_COLUMNS).eq("lead_id", lead.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw new Error("โหลดโครงการไม่ได้ กรุณาลองใหม่");
  const projects = projectSchema.array().parse(data);
  const ids = [...new Set(projects.flatMap(project => project.cancelled_by ?? []))];
  const names = new Map<string, string>();
  if (ids.length) {
    const staff = await supabase.from("staff").select("id,full_name").in("id", ids);
    if (staff.error) throw new Error("โหลดโครงการไม่ได้ กรุณาลองใหม่");
    for (const row of staff.data) names.set(row.id as string, row.full_name as string);
  }
  return { projects, names };
}
