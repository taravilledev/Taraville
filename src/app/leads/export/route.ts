import { requireStaff } from "@/lib/supabase/staff";
import { listLeadSchema } from "@/lib/walkin/models";
import { filteredLeads } from "@/lib/walkin/queries";
import { filtersSchema } from "@/lib/walkin/lead-list";
import { EXPORT_LIMIT, leadsCsv } from "@/lib/walkin/lead-csv";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Executive-only CSV of the leads matching the list's filters, one brand at a time (ADR 0011). */
export async function GET(request: Request) {
  const session = await requireStaff();
  // RLS would already limit a Sale to their own leads; export itself is an Executive permission.
  if (session.staff.role !== "executive") return text("ไม่มีสิทธิ์ส่งออกข้อมูล", 403);
  const raw = Object.fromEntries([...new URL(request.url).searchParams].filter(([, value]) => value !== ""));
  const parsed = filtersSchema.safeParse(raw);
  const brand = parsed.success ? parsed.data.brand : undefined;
  if (!parsed.success || !brand) return text("กรุณาเลือกแบรนด์ก่อนส่งออก", 400);
  const filters = parsed.data;

  const [leads, staff, projects] = await Promise.all([
    filteredLeads(session, filters).range(0, EXPORT_LIMIT - 1),
    session.supabase.from("staff").select("id,full_name"),
    session.supabase.from("projects").select("lead_id,code").eq("status", "active"),
  ]);
  if (leads.error || staff.error || projects.error) return text("ส่งออกไม่ได้ กรุณาลองใหม่", 500);
  const rows = listLeadSchema.array().parse(leads.data ?? []);
  // Never hand over a silently truncated file; count is exact and the API may cap rows below the requested range.
  if ((leads.count ?? 0) > rows.length) return text(`ข้อมูลเกิน ${EXPORT_LIMIT.toLocaleString("th-TH")} รายการ กรุณาเพิ่มตัวกรอง เช่น ช่วงวันที่`, 413);

  const ownerName = new Map(staff.data.map(row => [row.id as string, row.full_name as string]));
  const projectCode = new Map(projects.data.map(row => [row.lead_id as string, row.code as string]));
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return new Response(leadsCsv(brand, rows, ownerName, projectCode), { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="leads-${brand.toLowerCase()}-${day}.csv"`,
  } });
}
