import { z } from "zod";

const count = z.string().regex(/^\d{0,3}$/);
export const houseBriefSchema = z.object({
  model: z.string().trim().max(200),
  stories: count,
  bedrooms: count,
  living_rooms: count,
  bathrooms: count,
  kitchens: count,
  roof: z.string().trim().max(200),
  usable_area: z.string().regex(/^(?:\d{1,9}(?:\.\d{1,3})?)?$/),
  budget: z.string().trim().max(200),
  payment_method: z.enum(["", "เงินสด", "สินเชื่อธนาคาร"]),
  layout: z.string().trim().max(1000),
});
export const houseBriefFields = [
  { key: "model", label: "แบบบ้าน" },
  { key: "stories", label: "จำนวนชั้น", mode: "numeric" },
  { key: "bedrooms", label: "ห้องนอน", mode: "numeric" },
  { key: "living_rooms", label: "ห้องรับแขก", mode: "numeric" },
  { key: "bathrooms", label: "ห้องน้ำ", mode: "numeric" },
  { key: "kitchens", label: "ห้องครัว", mode: "numeric" },
  { key: "roof", label: "ลักษณะหลังคา" },
  { key: "usable_area", label: "พื้นที่ใช้สอย (ตร.ม.)", mode: "decimal" },
  { key: "budget", label: "งบก่อสร้าง (บาท)" },
  { key: "payment_method", label: "วิธีชำระเงิน" },
  { key: "layout", label: "ฟังก์ชันเพิ่มเติม" },
] as const satisfies readonly { key: keyof z.infer<typeof houseBriefSchema>; label: string; mode?: "numeric" | "decimal" }[];
