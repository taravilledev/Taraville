import { issuerSchema } from "@/lib/sales/financial-models";
import type { salesBootstrap } from "@/lib/sales/queries";

export type Issuer = ReturnType<typeof issuerSchema.parse>;
export type Brand = Issuer["brand"];

export async function loadIssuer(supabase: Awaited<ReturnType<typeof salesBootstrap>>["supabase"], brand: Brand): Promise<Issuer | undefined> {
  const result = await supabase.rpc("sales_issuer_settings");
  if (result.error) throw new Error("โหลดข้อมูลผู้ออกเอกสารไม่ได้ กรุณาลองใหม่");
  return issuerSchema.array().parse(result.data).find(item => item.brand === brand);
}
