import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { z } from "zod";
import { salesCase } from "@/lib/sales/queries";
import { formatMoney } from "@/lib/sales/money";
import { moneySummary, nextStep, type CaseTab } from "@/lib/sales/case-progress";
import { AppShell } from "@/app/walkin/app-shell";
import { PageSkeleton } from "@/app/walkin/page-skeleton";
import { ActionForm } from "@/app/walkin/action-form";
import { assignCase } from "../actions";
import { CaseForm } from "./case-form";
import { CaseHeader } from "./case-header";
import { DesignPanel, PendingPayments, PreparePayment, Receipts } from "./financial-panel";
import { financialSchema } from "@/lib/sales/financial-models";
import { QuotationPanel, SchedulePanel } from "./agreement-panel";
import { agreementSchema } from "@/lib/sales/agreement-models";
import { refundSchema } from "@/lib/sales/refund-models";
import { RefundPanel } from "./refund-panel";
import { AdjustmentPanel } from "./adjustment-panel";
import { BookingSummary } from "./booking-summary";
import { AcceptanceForm } from "./acceptance-form";
import styles from "../sales.module.css";

export const metadata = { title: "ข้อมูลงานและรายการขาย · Taraville Group", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const tabLabels: Record<CaseTab, string> = { overview: "ภาพรวม", documents: "เอกสาร", money: "รับเงิน", adjust: "แก้ไข/ยกเลิก" };

export default function CasePage(props: Props) { return <Suspense fallback={<PageSkeleton />}><CaseDetail {...props} /></Suspense>; }
async function CaseDetail({ params, searchParams }: Props) {
  const { id } = await params;
  const raw = (await searchParams).tab;
  const { staff, sale, supabase } = await salesCase(id);
  const workResult = !sale.can_finance && sale.brand === "BAAN_KUNAPAP" && sale.status === "contracted" && sale.permissions["acceptance.record"]
    ? await supabase.rpc("sales_acceptance_detail", { p_case_id: id }) : null;
  if (workResult?.error) throw new Error("โหลดรายการตรวจรับไม่ได้ กรุณาลองใหม่");
  const work = workResult ? z.object({ id: z.uuid(), position: z.number().int(), progress_percent: z.number().nullable(),
    accepted: z.boolean() }).array().parse(workResult.data) : [];
  const financeResult = sale.can_finance ? await supabase.rpc("sales_financial_detail", { p_case_id: id }) : null;
  if (financeResult?.error) throw new Error("โหลดข้อมูลรับเงินไม่ได้ กรุณาลองใหม่");
  const finance = financeResult ? financialSchema.parse(financeResult.data) : null;
  const agreementResult = sale.can_finance ? await supabase.rpc("sales_agreement_detail", { p_case_id: id }) : null;
  if (agreementResult?.error) throw new Error("โหลดข้อมูลสัญญาไม่ได้ กรุณาลองใหม่");
  const agreement = agreementResult ? agreementSchema.parse(agreementResult.data) : null;
  const closeoutResult = sale.can_finance && sale.status === "cancelled"
    ? await supabase.rpc("sales_closeout_detail", { p_case_id: id }) : null;
  if (closeoutResult?.error) throw new Error("โหลดยอดปิดงานไม่ได้ กรุณาลองใหม่");
  const closeout = z.object({ document_id: z.uuid(), retained_cents: z.string(), received_cents: z.string(),
    remaining_cents: z.string(), refund_due_cents: z.string() }).nullable().parse(closeoutResult?.data ?? null);
  const reservationResult = sale.can_finance && sale.brand === "TARAVILLE" ? await supabase.rpc("sales_reservation_detail", { p_case_id: id }) : null;
  if (reservationResult?.error) throw new Error("โหลดสถานะจองไม่ได้ กรุณาลองใหม่");
  const reservation = reservationResult ? z.object({ active: z.boolean(), options: z.object({ id: z.uuid(), label: z.string() }).array() }).parse(reservationResult.data) : null;
  const refundResult = sale.can_finance ? await supabase.rpc("sales_refund_detail", { p_case_id: id }) : null;
  if (refundResult?.error) throw new Error("โหลดข้อมูลคืนเงินไม่ได้ กรุณาลองใหม่");
  const refunds = refundResult ? refundSchema.array().parse(refundResult.data) : [];
  const assignments = sale.can_assign ? await supabase.from("staff").select("id,full_name").eq("is_active", true).order("full_name") : { data: [], error: null };
  if (assignments.error) throw new Error("โหลดผู้รับผิดชอบไม่ได้ กรุณาลองใหม่");
  const owners = z.object({ id: z.uuid(), full_name: z.string() }).array().parse(assignments.data);

  const tabs = (sale.can_finance ? ["overview", "documents", "money", "adjust"] : ["overview"]) as CaseTab[];
  const tab = tabs.find(item => item === raw) ?? "overview";
  const pending = finance?.pending.length ?? 0;
  const rows = (agreement?.instalments ?? []).filter(row => row.is_active).sort((a, b) => a.position - b.position);
  const row = rows.find(item => item.balance?.outstanding_cents !== "0");
  const contract = agreement?.documents.find(doc => doc.kind === "contract" && ["awaiting_signature", "signed"].includes(doc.state));
  const quotations = agreement?.documents.filter(doc => doc.kind === "quotation") ?? [];
  const summary = finance && agreement ? moneySummary({ net: sale.net_price_cents ?? null, payments: finance.payments, instalments: agreement.instalments }) : null;
  const step = finance && agreement ? nextStep({
    brand: sale.brand, status: sale.status, can: sale.permissions, hasNetPrice: sale.net_price_cents != null,
    hasSummary: finance.documents.some(doc => doc.kind === "summary"), hasBookingReceipt: finance.payments.some(payment => payment.kind === "booking"),
    hasDesignPlan: finance.design_plan != null, pendingPayments: pending,
    refundsToAct: refunds.filter(refund => refund.state === "pending" || refund.state === "approved").length,
    plotHeld: reservation?.active ?? false, isSettled: agreement.is_settled,
    quotations: { offered: quotations.filter(doc => doc.state === "offered").length, accepted: quotations.filter(doc => doc.state === "accepted").length },
    contract: contract ? contract.state === "signed" ? "signed" : "awaiting" : "none",
    instalment: row ? { label: row.label, needsAcceptance: row.needs_acceptance, accepted: row.accepted_at != null,
      hasInvoice: row.invoice_id != null, outstanding: row.balance?.outstanding_cents !== "0" } : null,
  }) : null;
  const canEditSale = sale.permissions["financial.prepare"] && ["draft", "reserved"].includes(sale.status);

  return <AppShell staff={staff} wide><div className={styles.page}>
    <CaseHeader sale={sale} summary={summary} step={step} />
    {tabs.length > 1 && <nav className={styles.tabs} aria-label="หมวดข้อมูลงาน">{tabs.map(item => <Link key={item} href={`/sales/${sale.id}?tab=${item}`} prefetch={false}
      aria-current={item === tab ? "page" : undefined}>{tabLabels[item]}{item === "money" && pending > 0 ? ` (${pending})` : ""}</Link>)}</nav>}

    {tab === "overview" && <>
      <section className={styles.panel}><h2>ข้อมูลงาน</h2><dl className={styles.facts}>
        <div><dt>ผู้รับผิดชอบงาน/รายการขาย</dt><dd>{sale.responsible_name}</dd></div><div><dt>เจ้าของ Lead ปัจจุบัน</dt><dd>{sale.lead_owner_name}</dd></div>
        {sale.can_finance && <>
          {sale.brand === "TARAVILLE" && <div><dt>แปลง/บ้าน</dt><dd>{sale.unit_label ?? "—"}</dd></div>}
          <div><dt>ราคาขาย</dt><dd>{sale.list_price_cents != null ? `${formatMoney(sale.list_price_cents)} บาท` : "—"}</dd></div>
          <div><dt>ราคาสุทธิ</dt><dd>{sale.net_price_cents != null ? `${formatMoney(sale.net_price_cents)} บาท` : "—"}</dd></div>
          <div><dt>โทรศัพท์ลูกค้า</dt><dd>{sale.customer_snapshot?.phone || "—"}</dd></div><div><dt>ที่อยู่ลูกค้า</dt><dd>{sale.customer_snapshot?.address || "—"}</dd></div>
        </>}
      </dl><p><Link href={`/leads/${sale.lead_id}`} prefetch={false}>เปิด Lead ต้นทาง</Link></p></section>
      {canEditSale && <section className={styles.panel} id="edit"><details open={sale.net_price_cents == null}><summary><h2>แก้ข้อมูลการขาย</h2></summary>
        <CaseForm sale={sale} requestId={randomUUID()} /></details></section>}
      {sale.can_assign && <section className={styles.panel}><details><summary><h2>เปลี่ยนผู้รับผิดชอบงาน</h2></summary>
        <p className={styles.muted}>ไม่เปลี่ยนเจ้าของ Lead หรือเพิ่มสิทธิ์การเงินให้ผู้รับผิดชอบใหม่</p>
        <ActionForm action={assignCase.bind(null, { id: sale.id, version: sale.version, requestId: randomUUID() })} label="เปลี่ยนผู้รับผิดชอบ">
          <label className={styles.field}>ผู้รับผิดชอบ<select name="responsible_id" defaultValue={sale.responsible_id}>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label>
        </ActionForm></details></section>}
      {!sale.can_finance && <p className={styles.notice}>คุณดูข้อมูลงานได้ แต่ไม่มีสิทธิ์ดูเอกสารและข้อมูลการเงินของรายการนี้ ให้ผู้บริหารตรวจสอบสิทธิ์หากจำเป็นต้องใช้</p>}
      {work.length > 0 && <section className={styles.panel}><h2>ตรวจรับงานก่อสร้าง</h2>
        {work.map(item => <details key={item.id}><summary>งวดที่ {item.position}{item.progress_percent == null ? "" : ` · ความคืบหน้า ${item.progress_percent}%`} · {item.accepted ? "ตรวจรับแล้ว" : "รอตรวจรับ"}</summary>
          {!item.accepted && <AcceptanceForm caseId={sale.id} identity={{ id: item.id, version: sale.version, requestId: randomUUID() }} />}
        </details>)}
      </section>}
    </>}

    {tab === "documents" && finance && agreement && <>
      <BookingSummary sale={sale} finance={finance} />
      <DesignPanel sale={sale} finance={finance} />
      <QuotationPanel sale={sale} agreement={agreement} />
    </>}

    {tab === "money" && finance && agreement && <>
      {!finance.issuer_ready && <p className={styles.notice}>ยังไม่ได้ตั้งค่าบริษัทผู้ออกเอกสาร ให้ผู้บริหารตั้งค่าก่อนยืนยันรับเงินและออกใบเสร็จ</p>}
      <PendingPayments sale={sale} finance={finance} />
      <SchedulePanel sale={sale} agreement={agreement} />
      {sale.status === "contracted" && agreement.is_settled && <p className={styles.notice}>ชำระครบทุกงวดตามสัญญาแล้ว</p>}
      <PreparePayment sale={sale} finance={finance} />
      <Receipts sale={sale} finance={finance} />
    </>}

    {tab === "adjust" && finance && agreement && <>
      {closeout && <section className={styles.panel}><h2>ยอดปิดงานปัจจุบัน</h2>
        <dl className={styles.facts}>
          <div><dt>ยอดตามข้อตกลงปิดงาน</dt><dd>{formatMoney(closeout.retained_cents)} บาท</dd></div>
          <div><dt>รับสุทธิหลังหักยอดคืนแล้ว</dt><dd>{formatMoney(closeout.received_cents)} บาท</dd></div>
          <div><dt>ยังต้องรับ</dt><dd>{formatMoney(closeout.remaining_cents)} บาท</dd></div>
          <div><dt>ยังต้องคืน</dt><dd>{formatMoney(closeout.refund_due_cents)} บาท</dd></div>
        </dl>
        <Link href={`/sales/documents/${closeout.document_id}`} prefetch={false}>เปิดข้อตกลงปิดงาน</Link>
      </section>}
      <AdjustmentPanel sale={sale} agreement={agreement} reservation={reservation} />
      {(finance.payments.length > 0 || refunds.length > 0) && <RefundPanel sale={sale} finance={finance} refunds={refunds} staffId={staff.id} />}
    </>}
  </div></AppShell>;
}
