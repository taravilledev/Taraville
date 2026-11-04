"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/supabase/staff";
import { salesMutation } from "@/lib/sales/mutations";
import { parseMoney } from "@/lib/sales/money";
import type { ActionState } from "@/app/walkin/action-form";

const identity = z.object({ id: z.uuid(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), requestId: z.uuid() });
const agreement = z.object({ reason: z.string().trim().min(1).max(1000), text: z.string().trim().min(1).max(100000), proof: z.string().min(1).max(200) });

export async function changeReservedUnit(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const fields = z.object({ unit: z.uuid(), price: z.string(), reason: z.string().trim().min(1).max(1000), proof: z.string().min(1).max(200) }).safeParse({
    unit: form.get("unit"), price: form.get("price") ?? "", reason: form.get("reason"), proof: form.get("proof_path"),
  });
  if (!parsed.success || !fields.success || form.get("confirmed") !== "on") return { error: "กรอกข้อตกลงและแนบหลักฐานก่อนเปลี่ยนแปลง" };
  if (form.has("signed_agreement")) {
    const agreement = z.string().trim().min(1).max(100000).safeParse(form.get("signed_agreement"));
    if (!agreement.success) return { error: "กรอกข้อความข้อตกลงแก้ไขที่ลงนามแล้ว" };
    return salesMutation(session, "sales_change_signed_plot", {
      p_case_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId,
      p_unit_id: fields.data.unit, p_reason: fields.data.reason, p_evidence_path: fields.data.proof, p_agreement_text: agreement.data,
    }, "case");
  }
  let price: string;
  try { price = parseMoney(fields.data.price); } catch { return { error: "ตรวจสอบราคาสุทธิใหม่" }; }
  return salesMutation(session, "sales_change_reserved_unit", {
    p_case_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId,
    p_unit_id: fields.data.unit, p_price_cents: price, p_reason: fields.data.reason, p_evidence_path: fields.data.proof,
  }, "case");
}

export async function saveBookingSummary(context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const date = z.union([z.iso.date(), z.literal("")]);
  const terms = z.object({ conditions: z.string().max(5000), freebies: z.string().max(5000),
    booking_date: date, contract_date: date, down_date: date }).safeParse({
    conditions: form.get("conditions"), freebies: form.get("freebies"),
    booking_date: form.get("booking_date") ?? "", contract_date: form.get("contract_date") ?? "", down_date: form.get("down_date") ?? "",
  });
  if (!parsed.success || !terms.success) return { error: "ตรวจสอบรายละเอียดสรุปการจอง" };
  let amounts;
  let mortgage: string | null;
  try {
    const rawMortgage = z.string().parse(form.get("mortgage") ?? "").trim();
    mortgage = rawMortgage ? parseMoney(rawMortgage) : null;
    amounts = Object.fromEntries(["booking", "contract", "down"].map(key => {
      const raw = z.string().parse(form.get(key)).trim();
      return [`${key}_cents`, raw ? parseMoney(raw) : null];
    }));
  } catch { return { error: "กรอกยอดเป็นบาท ทศนิยมไม่เกินสองตำแหน่ง" }; }
  return salesMutation(session, "sales_save_booking_summary", {
    p_case_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId,
    p_input: { ...terms.data, ...amounts, mortgage_cents: mortgage },
  }, "case");
}

export async function saveReservation(mode: "confirm" | "release", context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  if (!parsed.success || form.get("confirmed") !== "on") return { error: "กรุณายืนยันการทำรายการ" };
  const params = { p_case_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId };
  if (mode === "confirm") return salesMutation(session, "sales_confirm_reservation", params, "case");
  const reason = z.string().trim().min(1).max(1000).safeParse(form.get("reason"));
  if (mode !== "release" || !reason.success) return { error: "กรุณาระบุเหตุผลที่ปล่อยแปลง" };
  return salesMutation(session, "sales_release_reservation", { ...params, p_reason: reason.data }, "case");
}

export async function saveAdjustment(mode: "amend" | "close", context: unknown, _state: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireStaff(true);
  const parsed = identity.safeParse(context);
  const fields = agreement.safeParse({ reason: form.get("reason"), text: form.get("agreement"), proof: form.get("proof_path") });
  if (!parsed.success || !fields.success || form.get("confirmed") !== "on") return { error: "กรอกข้อตกลง แนบหลักฐาน และยืนยันก่อนบันทึก" };
  const common = { p_case_id: parsed.data.id, p_version: parsed.data.version, p_request_id: parsed.data.requestId,
    p_reason: fields.data.reason, p_agreement_text: fields.data.text, p_evidence_path: fields.data.proof };
  if (mode === "close") {
    const retained = z.string().safeParse(form.get("retained"));
    let amount: string;
    try { amount = parseMoney(retained.success ? retained.data : ""); }
    catch { return { error: "กรอกยอดที่บริษัทมีสิทธิ์ได้รับตามข้อตกลงเป็นบาท" }; }
    return salesMutation(session, "sales_close_case", { ...common, p_retained_cents: amount }, "case");
  }
  if (mode !== "amend") return { error: "รายการไม่ถูกต้อง" };
  const rows = z.uuid().array().min(1).max(101).safeParse(form.getAll("instalment_id"));
  if (!rows.success) return { error: "ตรวจสอบรายการงวดชำระ" };
  let amounts;
  try {
    amounts = rows.data.map(id => ({
      id,
      gross_cents: parseMoney(z.string().parse(form.get(`gross_${id}`))),
      credit_cents: parseMoney(z.string().parse(form.get(`credit_${id}`))),
    }));
  } catch { return { error: "กรอกยอดงวดและเครดิตเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง" }; }
  return salesMutation(session, "sales_amend_contract", { ...common, p_rows: amounts, p_work_changed: form.get("work_changed") === "on" }, "case");
}
