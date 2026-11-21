import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { LEAD_COLUMNS, PROJECT_COLUMNS, leadSchema, projectSchema, staffSchema } from "./models";
import { privacyEventSchema } from "./privacy";
import { activeSurveyFilters, instalmentClause, registrationRange, stageTab, type LeadFilters } from "./lead-list";
import { STAGE_GROUPS, STAGE_GROUP_CODES, stageGroupOf, stageSchema, type StageGroup } from "./lead-stage";

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
  // The Taraville location answer is searched with the name, so it is not a filter of its own.
  for (const term of (filters.q ?? "").replace(/[%,()*\\"]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3)) {
    request = request.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%,line_id.ilike.%${term}%,survey->>preferred_location.ilike.%${term}%`);
  }
  const tab = stageTab(filters);
  if (tab !== "all") request = request.in("stage", STAGE_GROUP_CODES[tab]);
  if (filters.brand) request = request.eq("brand", filters.brand);
  if (filters.owner && filters.owner !== "all") request = request.eq("owner_id", filters.owner);
  const { from, to } = registrationRange(filters);
  if (from) request = request.gte("created_at", `${from}T00:00:00+07:00`);
  if (to) request = request.lte("created_at", `${to}T23:59:59.999999+07:00`);
  const { budget, channel } = activeSurveyFilters(filters);
  if (budget.length) request = filters.brand === "TARAVILLE" ? request.or(instalmentClause(budget)) : request.in("survey->>budget_range", budget);
  if (channel.length) request = request.in("survey->>channel", channel);
  const ascending = filters.dir === "asc";
  return request.order("created_at", { ascending }).order("id", { ascending });
}

/** Lead counts per stage tab under every other filter; "all" is the sum, and the stage and page are ignored. */
export async function stageCounts(session: Awaited<ReturnType<typeof requireStaff>>, filters: LeadFilters) {
  const count = async (group: StageGroup) => {
    const { count, error } = await filteredLeads(session, { ...filters, stage: group }).range(0, 0);
    if (error) throw new Error("โหลดรายการไม่ได้ กรุณาลองใหม่");
    return count ?? 0;
  };
  const [open, project, closed] = await Promise.all(STAGE_GROUPS.map(count));
  return { all: open + project + closed, open, project, closed };
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
  const { data, error } = await session.supabase.from("staff").select("id,full_name,role,is_active")
    .eq("role", "sale").eq("is_active", true).order("full_name");
  if (error) throw new Error("โหลดรายชื่อผู้ดูแลไม่ได้ กรุณาลองใหม่");
  return staffSchema.array().parse(data);
}

/** The stage group the list files this Lead under, so the Lead page and the list never disagree. */
export async function leadStageGroup(session: Awaited<ReturnType<typeof leadDetail>>) {
  const { data, error } = await session.supabase.from("walkin_leads_staged").select("stage").eq("id", session.lead.id).maybeSingle();
  const stage = stageSchema.safeParse(data?.stage);
  if (error || !stage.success) throw new Error("โหลดสถานะรายการไม่ได้ กรุณาลองใหม่");
  return stageGroupOf(stage.data);
}

/** Names of whoever recorded the evidence events. */
export async function evidenceActors(session: Awaited<ReturnType<typeof leadDetail>>) {
  const ids = [...new Set(session.events.map(event => event.actor_id))];
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const { data, error } = await session.supabase.from("staff").select("id,full_name").in("id", ids);
  if (error) throw new Error("โหลดประวัติหลักฐานไม่ได้ กรุณาลองใหม่");
  for (const row of data) names.set(row.id as string, row.full_name as string);
  return names;
}

/** Who closed the lead and the free-text reason. */
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

/** Projects of a lead, newest first, with the names of whoever cancelled them. */
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

/** The owner's Leads that have not opened a project yet (stage group "open"); null on error so the Sale home shows "—". */
export async function openLeadCount(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], ownerId: string) {
  const { count, error } = await supabase.from("walkin_leads_staged").select("id", { count: "exact", head: true })
    .in("stage", STAGE_GROUP_CODES.open).eq("owner_id", ownerId);
  return error ? null : count;
}
