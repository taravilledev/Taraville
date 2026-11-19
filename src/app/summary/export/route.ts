import { executiveSummary } from "@/lib/sales/executive";
import { requireStaff } from "@/lib/supabase/staff";
import { summaryCsv, summaryQuery, summaryReport } from "../summary-model";

const error = (body: string, status: number) => new Response(body, {
  status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
});

export async function GET(request: Request) {
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "executive") return error("ไม่มีสิทธิ์ส่งออกรายงาน", 403);

  const params = new URL(request.url).searchParams;
  const raw = Object.fromEntries([...new Set(params.keys())].map(key => {
    const values = params.getAll(key);
    return [key, values.length === 1 ? values[0] : values];
  }));
  const query = summaryQuery(raw);
  if (!query.isPeriodValid) return error("กรุณาระบุช่วงวันที่ที่ถูกต้อง", 400);

  const projects = await executiveSummary(supabase, query);
  if (!projects) return error("ส่งออกรายงานไม่ได้ กรุณาลองใหม่", 500);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  return new Response(summaryCsv(summaryReport(projects, today, query)), { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="bkp-project-summary-${today}.csv"`,
  } });
}
