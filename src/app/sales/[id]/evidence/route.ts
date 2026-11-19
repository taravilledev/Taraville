import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireStaff(); const { id } = await params;
  const path = request.nextUrl.searchParams.get("path");
  if (!z.uuid().safeParse(id).success || !path || !path.startsWith(`${id}/`)) return new Response("ไม่พบหลักฐาน", { status: 404 });
  // Download with the current user's token so revocation also covers old links.
  const result = await supabase.storage.from("sales-evidence").download(path);
  if (result.error || !result.data) return new Response("ไม่พบหลักฐานหรือไม่มีสิทธิ์เข้าถึง", { status: 404 });
  return new Response(result.data, { headers: { "Content-Type": result.data.type, "Cache-Control": "private, no-store",
    "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}
