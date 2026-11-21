import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import ts from "typescript";
import type { Lead, Project, Staff } from "./models";
import type { PrivacyEvent } from "./privacy";
import type { SalesBootstrap } from "../sales/models";

const nodeRequire = createRequire(import.meta.url);
const owner: Staff = { id: "91000000-0000-4000-a000-000000000001", full_name: "Owner Sale", role: "sale", is_active: true };
const reader: Staff = { ...owner, id: "91000000-0000-4000-a000-000000000002", full_name: "Other Sale" };
const executive: Staff = { ...owner, id: "91000000-0000-4000-a000-000000000003", full_name: "Executive", role: "executive" };
const baseLead: Lead = {
  id: "92000000-0000-4000-a000-000000000001", brand: "BAAN_KUNAPAP", name_title: "", first_name: "Shared customer",
  last_name: "Fixture", phone: "0000000000", line_id: "shared-line", survey: { gender: "หญิง" },
  owner_id: owner.id, created_by: owner.id, version: 1, privacy_mode: "real", last_contact_at: null,
  created_at: "2026-10-30T01:00:00Z", updated_at: "2026-10-30T01:00:00Z", closed_at: null, closed_by: null, closed_reason: null,
};
let staff = reader;
let lead = { ...baseLead };
let events: PrivacyEvent[] = [{
  id: 1, kind: "initial", survey_consent: false, notice_presented: true, followup_requested: true,
  actor_id: owner.id, notice_version: "historical-notice", notice_hash: "historical-evidence-hash", recorded_at: baseLead.created_at,
}];
let projects: Project[] = [];
let work: unknown = { canCreate: false, cases: [] };
const session = () => ({ staff, lead, events, supabase: { from: () => ({ select: () => ({ eq: () => ({
  maybeSingle: async () => ({ data: owner, error: null }),
}) }) }) } });
const passthrough = ({ children }: { children?: ReactNode }) => createElement("main", null, children);
const noop = () => undefined;
const pageQueries = {
  leadDetail: async () => session(), saleOwners: async () => [owner, reader],
  closeInfo: async () => ({ text: "Historical close reason", by: "Historical closer" }),
  leadProjects: async () => ({ projects, names: new Map([[executive.id, executive.full_name]]) }),
  leadStageGroup: async () => (lead.closed_at ? "closed" : projects.length ? "project" : "open"),
  evidenceActors: async () => new Map([[owner.id, owner.full_name]]),
  filteredLeads: () => ({ range: async () => ({ data: [{ ...lead, stage: "received" }], error: null, count: 1 }) }),
  brandCounts: async () => ({ all: 1, taraville: 0, baanKunapap: 1 }),
  stageCounts: async () => ({ all: 1, open: 1, project: 0, closed: 0 }),
};
const mocks: Record<string, unknown> = {
  "server-only": {},
  "next/navigation": {
    notFound: () => { throw new Error("CHECK_NOT_FOUND"); }, useRouter: () => ({ replace: noop }), useSearchParams: () => new URLSearchParams(),
    redirect: (url: string) => { throw new Error(`CHECK_REDIRECT ${url}`); },
  },
  "next/link": ({ href, children, "aria-label": label }: { href: string; children?: ReactNode; "aria-label"?: string }) => createElement("a", { href, "aria-label": label }, children),
  "@/lib/walkin/queries": pageQueries,
  "@/lib/sales/lead-work": { leadWork: async () => work, leadTags: async () => new Map() },
  "@/lib/supabase/staff": { requireStaff: async () => session() },
  "@/app/walkin/app-shell": { AppShell: passthrough },
  "@/app/walkin/page-skeleton": { PageSkeleton: () => createElement("p", null, "Loading fixture") },
  "@/app/walkin/retention-review": { RetentionReview: () => null },
  "@/app/walkin/form-header": { FormHeader: () => null },
  "@/app/walkin/lead-form": { LeadForm: () => createElement("form", { "data-edit-form": "true" }) },
};
const cache = new Map<string, Record<string, unknown>>();
function load(file: URL): Record<string, unknown> {
  if (cache.has(file.href)) return cache.get(file.href)!;
  const exports: Record<string, unknown> = {};
  cache.set(file.href, exports);
  const require = (name: string): unknown => {
    if (name in mocks) return mocks[name];
    if (name.endsWith(".css")) return {};
    if (name.endsWith("/action-form") || name === "./action-form") return {
      ActionForm: ({ label, children }: { label: string; children?: ReactNode }) =>
        createElement("form", null, children, createElement("button", null, label)),
    };
    if (/\/(actions|privacy-actions|status-actions|project-actions)$/.test(name)) return {
      reassignLead: noop, recordPrivacy: noop, closeLead: noop, reopenLead: noop, openProject: noop, cancelProject: noop, createCase: noop,
    };
    if (name === "./versioned-notice") return { VersionedNotice: () => createElement("p", null, "Versioned notice") };
    if (!name.startsWith(".") && !name.startsWith("@/")) return nodeRequire(name);
    const path = name.startsWith("@/") ? new URL(`../../${name.slice(2)}`, import.meta.url) : new URL(name, file);
    if (path.pathname.endsWith(".json")) return JSON.parse(readFileSync(path, "utf8"));
    for (const extension of [".ts", ".tsx"]) {
      const candidate = new URL(path.href + extension);
      if (existsSync(candidate)) return load(candidate);
    }
    throw new Error(`Unmocked import ${name}`);
  };
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(compiled, { exports, require, Date, URLSearchParams }, { timeout: 1000 });
  return exports;
}
type Page = (props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) => ReactNode;
const DetailPage = load(new URL("../../app/leads/[id]/page.tsx", import.meta.url)).default as Page;
const EditPage = load(new URL("../../app/leads/[id]/edit/page.tsx", import.meta.url)).default as Page;
const ManagePage = load(new URL("../../app/leads/[id]/manage/page.tsx", import.meta.url)).default as Page;
const HistoryPage = load(new URL("../../app/leads/[id]/history/page.tsx", import.meta.url)).default as Page;
const CancelProjectSection = load(new URL("../../app/walkin/cancel-project-section.tsx", import.meta.url)).CancelProjectSection as
  (props: { supabase: unknown; sale: { project_id: string | null; lead_id: string; id: string; status: string } }) => Promise<ReactNode>;
const ListPage = load(new URL("../../app/leads/page.tsx", import.meta.url)).default as Page;
async function render(Page: Page) {
  const errors: unknown[] = [];
  const stream = await renderToReadableStream(createElement(Page, {
    params: Promise.resolve({ id: lead.id }), searchParams: Promise.resolve({ brand: "BAAN_KUNAPAP" }),
  }), { onError: error => { errors.push(error); } });
  await stream.allReady;
  return { html: await new Response(stream).text(), errors };
}
const html = (text: string) => text.replace(/<!--.*?-->/g, "");
const count = (text: string, pattern: string) => text.split(pattern).length - 1;

// ADR 0061: manage and history are gone as pages; the old links land on the Lead page, history as its drawer.
for (const [Page, target] of [[ManagePage, `/leads/${lead.id}`], [HistoryPage, `/leads/${lead.id}?drawer=history`]] as const) {
  // The redirect runs inside Suspense (Cache Components), so it surfaces through onError rather than a rejection.
  const { errors } = await render(Page);
  assert.ok(errors.some(error => error instanceof Error && error.message === `CHECK_REDIRECT ${target}`), `old link must redirect to ${target}`);
}

// Actual async pages and actual status/project/privacy children; only data and server-action boundaries are mocked.
for (const actor of [reader, owner, executive]) {
  staff = actor;
  const detail = await render(DetailPage);
  assert.deepEqual(detail.errors, [], `Detail render failed for ${actor.full_name}`);
  const page = html(detail.html);
  for (const text of ["Shared customer", "Owner Sale", "หญิง", "ลูกค้าไม่ให้ข้อมูลเพิ่มเติม"]) assert.ok(page.includes(text), `Shared detail missing ${text}`);
  assert.ok(page.includes("<h2>ความต้องการของลูกค้า</h2>") && page.includes("<h2>โครงการ</h2>"));
  for (const gone of ["ตัวเลือก ▾", "/manage", "/history", 'href="tel:', "บันทึกการติดต่อ", "ติดต่อล่าสุด", "ยืนยันยกเลิกโครงการ", "ยืนยันเปิดรายการอีกครั้ง"]) {
    assert.ok(!page.includes(gone), `Lead page must not carry ${gone}`);
  }
  // Evidence history is a drawer any staff may open, with who recorded each event.
  for (const text of ["ประวัติหลักฐานและความยินยอม", "ประวัติหลักฐาน (1)", "historical-evidence-hash", "historical-notice", "บันทึกโดย Owner Sale"]) assert.ok(page.includes(text), `History drawer missing ${text}`);
  const isAuthorized = actor !== reader;
  assert.equal(page.includes("แก้ไขข้อมูล"), isAuthorized);
  assert.equal(page.includes('aria-controls="open-project-dialog"'), isAuthorized, "Only an authorized actor can start a BKP Project");
  assert.equal(page.includes("เปลี่ยนตัวเลือก…"), isAuthorized);
  assert.equal(page.includes("ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม"), isAuthorized, "Opt-in lives in the survey drawer");
  assert.ok(!page.includes("ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม"), "Withdraw is offered only while the Customer has opted in");
  assert.equal(page.includes('aria-label="เปลี่ยนผู้ดูแล"'), actor === executive, "Only Executive gets the owner pencil");
  assert.equal(page.includes("ฝ่ายขายผู้ดูแล"), actor === executive);
  assert.equal(page.includes("ปิด Lead…") && page.includes('name="reason"'), isAuthorized, "Close Lead opens a reason dialog for owner and Executive");
  assert.ok(!page.includes("ยังปิด Lead นี้ไม่ได้"));
  const edit = await render(EditPage);
  if (actor === reader) {
    assert.deepEqual(edit.errors, [], "Nonowner edit renders the forbidden notice, not an error");
    assert.ok(edit.html.includes("ยังไม่มีสิทธิ์ทำงานนี้") && edit.html.includes("ขอให้ผู้บริหารเปลี่ยนผู้ดูแล"), "Nonowner edit says what is needed and who grants it");
    assert.ok(!edit.html.includes("data-edit-form"), "Nonowner edit must not render form");
  } else {
    assert.deepEqual(edit.errors, []);
    assert.ok(edit.html.includes("data-edit-form"), "Owner/Executive must retain edit form");
  }
  const list = await render(ListPage);
  assert.deepEqual(list.errors, []);
  assert.ok(list.html.includes(`value="${reader.id}"`), "Every active role must receive all owner filter options");
  assert.equal(list.html.includes("ส่งออก CSV"), actor === executive, "CSV remains Executive-only");
}

// A failed Customer Work read must not break the Lead page.
work = null;
staff = owner;
const failed = await render(DetailPage);
assert.deepEqual(failed.errors, []);
assert.ok(failed.html.includes("โหลดโครงการไม่ได้"));
assert.ok(!failed.html.includes('aria-controls="open-project-dialog"'), "Failed work loading must not expose the project CTA");
work = { canCreate: false, cases: [] };

// A closed Lead shows a grey band and, for owner and Executive, a one-click reopen at the bottom.
lead = { ...baseLead, closed_at: baseLead.created_at, closed_by: owner.id, closed_reason: "other" };
for (const actor of [reader, owner, executive]) {
  staff = actor;
  const closed = await render(DetailPage);
  assert.deepEqual(closed.errors, []);
  const page = html(closed.html);
  assert.ok(page.includes("Lead นี้ปิดแล้ว") && page.includes("Historical close reason") && page.includes("Historical closer"));
  assert.equal(page.includes("<button>เปิด Lead อีกครั้ง</button>"), actor !== reader);
  assert.ok(!page.includes("ปิด Lead…") && !page.includes('aria-controls="open-project-dialog"'), "A closed Lead can neither close again nor open a Project");
  assert.ok(page.includes("เปิด Lead อีกครั้งก่อนจึงจะเปิดโครงการได้"));
}
lead = { ...baseLead };
const projectId = "93000000-0000-4000-a000-000000000001";
projects = [{ id: projectId, lead_id: lead.id, code: "BKP-69-123", status: "active",
  version: 1, created_at: lead.created_at, cancelled_at: null, cancelled_by: null, cancel_reason: null }];
events = [{ ...events[0], survey_consent: true }];
const row = { id: null, code: "SC-1", status: "reserved", brand: "BAAN_KUNAPAP", project_id: projectId, can_open: false, can_finance: false };
work = { canCreate: false, cases: [row] };
for (const actor of [reader, owner, executive]) {
  staff = actor;
  const detail = await render(DetailPage);
  assert.deepEqual(detail.errors, []);
  const page = html(detail.html);
  assert.ok(page.includes("BKP-69-123") && page.includes("SC-1"));
  assert.ok(!page.includes("/sales/"), "A row the reader cannot open has no link");
  assert.ok(page.includes("ลูกค้าเลือกให้ข้อมูลเพิ่มเติม") && !page.includes("ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม"), "Opted in: only withdraw is offered");
  assert.equal(page.includes("ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม"), actor !== reader);
  assert.ok(!page.includes("ยืนยันยกเลิกโครงการ"), "Cancel Project moved to the Project page");
  assert.ok(!page.includes("ปิด Lead…"), "An active Project prevents closing");
  assert.equal(page.includes("ยังปิด Lead นี้ไม่ได้") && page.includes("ต้องยกเลิกโครงการก่อน"), actor !== reader, "The blocker is said in advance, not a bare disabled button");
}
// A Project without a sale is half open: a retry card (and the primary action) leads to the sale form for that Project.
staff = owner;
work = { canCreate: true, cases: [] };
const halfOpen = html((await render(DetailPage)).html);
assert.ok(halfOpen.includes(`/sales/new?lead=${lead.id}&amp;project=${projectId}`));
assert.equal(count(halfOpen, "ลองเปิดโครงการอีกครั้ง"), 2, "Retry card plus the primary action");
work = { canCreate: false, cases: [{ ...row, id: "94000000-0000-4000-a000-000000000001", status: "contracted", can_open: true }] };
const existingProject = html((await render(DetailPage)).html);
assert.ok(existingProject.includes('href="/sales/94000000-0000-4000-a000-000000000001"') && existingProject.includes("ไปที่โครงการ BKP-69-123"), "The only live Project is the primary action");
assert.ok(existingProject.includes('aria-controls="open-project-dialog"') && existingProject.includes("เปิดโครงการเพิ่ม"), "Opening another Project moves into the section");
assert.ok(existingProject.includes("ดูรายละเอียด"));
// Two live Projects: cards for both, no primary action; a finished one is folded.
work = { canCreate: true, cases: [{ ...row, id: "94000000-0000-4000-a000-000000000001", status: "contracted", can_open: true }] };
projects.push({ ...projects[0], id: "93000000-0000-4000-a000-000000000002", code: "BKP-69-124" });
const multipleProjects = html((await render(DetailPage)).html);
assert.ok(multipleProjects.includes("2 โครงการ") && multipleProjects.includes("BKP-69-123") && multipleProjects.includes("BKP-69-124"));
assert.equal(count(multipleProjects, "ลองเปิดโครงการอีกครั้ง"), 1, "Several live Projects have no primary action");
assert.ok(!multipleProjects.includes("โครงการที่จบแล้ว"));
projects.push({ ...projects[0], id: "93000000-0000-4000-a000-000000000003", code: "BKP-69-101", status: "cancelled", cancel_reason: "Changed plan", cancelled_by: executive.id, cancelled_at: lead.created_at });
assert.ok(html((await render(DetailPage)).html).includes("โครงการที่จบแล้ว (1)"), "Finished Projects are folded");
projects.splice(1);
work = { canCreate: false, cases: [{ ...row, id: "94000000-0000-4000-a000-000000000001", status: "cancelled", can_open: true }] };
const cancelledSale = (await render(DetailPage)).html;
assert.ok(cancelledSale.includes("ถูกยกเลิกแล้ว") && !cancelledSale.includes("ดำเนินโครงการต่อ"));

// Cancel Project is rendered at the bottom of the BKP project page for an active Project only.
const projectRow = (status: string) => ({ ...projects[0], status });
const cancelSection = async (status: string) => {
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: projectRow(status), error: null }) }) }) }) };
  const element = await CancelProjectSection({ supabase, sale: { project_id: projectId, lead_id: lead.id, id: "case", status: "contracted" } });
  if (!element) return "";
  const stream = await renderToReadableStream(element as ReturnType<typeof createElement>);
  await stream.allReady;
  return new Response(stream).text();
};
assert.ok((await cancelSection("active")).includes("ยืนยันยกเลิกโครงการ"));
assert.equal(await cancelSection("cancelled"), "");

lead = { ...baseLead, brand: "TARAVILLE" };
projects = [];
work = { canCreate: true, cases: [] };
const tv = html((await render(DetailPage)).html);
assert.ok(tv.includes("<h2>โครงการ</h2>") && tv.includes("ยังไม่มีโครงการ"));
const tvProjectLink = tv.indexOf(`href="/sales/new?lead=${lead.id}"`);
assert.ok(tvProjectLink >= 0 && tv.includes("เปิดโครงการ"), "Taraville opens the sale form from the primary action");
assert.ok(!tv.includes("เปิดรายการขายใหม่") && !tv.includes("งานของลูกค้า"));
lead = { ...baseLead };

// Execute the real shared query builder and owner roster, without a database or source-text assertions.
const queries = load(new URL("./queries.ts", import.meta.url)) as typeof import("./queries");
const calls: [string, unknown][] = [];
const request = {
  select: () => request, eq: (column: string, value: unknown) => { calls.push([column, value]); return request; },
  neq: () => request, in: () => request, order: () => request,
  then: (resolve: (value: { data: Staff[]; error: null }) => unknown) => Promise.resolve({ data: [owner, reader], error: null }).then(resolve),
};
const querySession = { staff: reader, supabase: { from: () => request } } as unknown as Parameters<typeof queries.filteredLeads>[0];
queries.filteredLeads(querySession, { owner: owner.id, dir: "desc", page: 1 });
assert.deepEqual(calls.find(([column]) => column === "owner_id"), ["owner_id", owner.id], "A Sale can filter another owner");
assert.equal((await queries.saleOwners(querySession)).length, 2, "Sale owner filter roster cannot be restricted to Executive");
const NewCaseForm = load(new URL("../../app/sales/new/new-case-form.tsx", import.meta.url)).NewCaseForm as
  (props: { workspace: SalesBootstrap; lead: SalesBootstrap["leads"][number]; projects: { id: string; code: string }[]; projectId: string; requestId: string; q: string; dev: string }) => ReactNode;
const openingLead: SalesBootstrap["leads"][number] = { id: baseLead.id, brand: "TARAVILLE", full_name: "Opening fixture", owner_id: owner.id, project_id: null, project_code: null };
const openingWorkspace: SalesBootstrap = { actor: { id: owner.id, full_name: owner.full_name, role: "sale" }, cases: [], leads: [openingLead], customers: [], developments: [], staff: [], can_admin: false, can_catalog: false };
async function renderOpening(workspace = openingWorkspace, brand = openingLead.brand) {
  const stream = await renderToReadableStream(createElement(NewCaseForm, { workspace, lead: { ...openingLead, brand }, projects: [{ id: "project", code: "BKP-fixture" }], projectId: "project", requestId: "request", q: "", dev: "" }));
  await stream.allReady;
  return new Response(stream).text();
}
const emptyOpening = await renderOpening();
assert.ok(!emptyOpening.includes("<form"), "No available unit means no create form or submit");
assert.ok(!emptyOpening.includes("/sales/settings/catalog"), "Catalog link requires capability");
assert.ok((await renderOpening({ ...openingWorkspace, can_catalog: true })).includes("/sales/settings/catalog"));
const development = { id: "development", name: "Available village", address: "", is_active: true, version: 1,
  units: [{ id: "unit", code: "A1", details: {}, list_price_cents: null, is_active: true, is_available: true, version: 1 }] };
const availableOpening = await renderOpening({ ...openingWorkspace, developments: [development], customers: [{ id: "customer", brand: "TARAVILLE", full_name: "Existing fixture", phone: "0000000000" }] });
// Plots are picked in the table; the only combobox is the searchable project filter (owner, 2026-11-22), which submits as `dev`.
assert.equal((availableOpening.match(/role="combobox"/g) ?? []).length, 1, "Taraville plots are browsed in the table; only the project filter is a combobox");
assert.ok(/<input[^>]*name="dev"/.test(availableOpening), "The project filter still submits the dev URL param");
assert.ok(availableOpening.includes("<table") && availableOpening.includes('type="search"'));
assert.equal((availableOpening.match(/name="unit_id"/g) ?? []).length, 1, "One create form per free plot, inside that plot's drawer");
assert.ok(!availableOpening.includes("Existing fixture") && !availableOpening.includes("checkbox"), "Lead data is used directly with no customer-switch UI");
assert.ok(!(await renderOpening({ ...openingWorkspace, developments: [{ ...development, units: [{ ...development.units[0], is_available: false }] }] })).includes('name="unit_id"'));
const bkpOpening = await renderOpening(openingWorkspace, "BAAN_KUNAPAP");
assert.ok(bkpOpening.includes('name="project_id"') && bkpOpening.includes("BKP-fixture"));
assert.ok(!bkpOpening.includes('name="unit_id"'), "BKP does not require a property unit");
// Real PlotTable filtering (URL params q/dev) and drawer form bindings.
const PlotTable = load(new URL("../../app/sales/new/plot-table.tsx", import.meta.url)).PlotTable as
  (props: { plots: typeof fieldUnits; leadId: string; requestId: string; q: string; dev: string; baseHref: string }) => ReactNode;
const fieldUnits = [
  { id: "u1", developmentId: "d1", code: "A1", location: "Project 1", address: "Address one", details: { model: "Model one" }, price: "10000" },
  { id: "u2", developmentId: "d2", code: "A1", location: "Project 2", address: "Address two", details: { model: "Model two" }, price: null },
];
async function renderBrowser(q = "", dev = "") {
  const stream = await renderToReadableStream(createElement(PlotTable, { plots: fieldUnits, leadId: "origin-lead", requestId: "origin-request", q, dev, baseHref: "/sales/new?lead=origin-lead" }));
  await stream.allReady;
  return new Response(stream).text();
}
const allUnits = await renderBrowser();
assert.match(allUnits, /<label[^>]*for="plot-dev"[^>]*>โครงการ<\/label>/);
assert.ok(allUnits.includes("Model one") && allUnits.includes("Model two") && allUnits.replaceAll("<!-- -->", "").includes("2 จาก 2 แปลงว่าง"), "Unfiltered table includes every eligible plot");
const filteredUnits = await renderBrowser("", "d2");
assert.ok(!filteredUnits.includes("Model one") && filteredUnits.includes("Model two"), "Project filter uses UUID despite duplicate plot code");
const searchedUnits = await renderBrowser("  ONE  ");
assert.ok(searchedUnits.includes("Model one") && !searchedUnits.includes("Model two"), "Search trims and ignores case");
const none = await renderBrowser("not-a-plot");
assert.ok(none.includes("ไม่พบแปลงที่ตรงกับเงื่อนไข") && none.includes('href="/sales/new?lead=origin-lead"'), "No match offers clearing the filter");
for (const text of ['name="unit_id" value="u2"', 'name="lead_id" value="origin-lead"', 'name="request_id" value="origin-request"', 'name="customer_id" value=""', "Address two", "เปิดโครงการด้วยแปลงนี้", "ยังไม่จองหรือกันแปลง", "ยังไม่ระบุ"]) assert.ok(allUnits.includes(text), `Drawer missing ${text}`);
assert.ok(!/<form[^>]*>(?:(?!<\/form>)[\s\S])*<form/.test(allUnits), "Drawer forms are never nested in the search form");
const DesignPackages = load(new URL("../../app/sales/[id]/tasks/design-packages.tsx", import.meta.url)).DesignPackages as
  (props: { initialArea: string; plan?: { tier: string; instalments: string[]; note: string } }) => ReactNode;
async function renderDesign(initialArea: string, plan?: { tier: string; instalments: string[]; note: string }) {
  const stream = await renderToReadableStream(createElement(DesignPackages, { initialArea, plan }));
  await stream.allReady;
  return new Response(stream).text();
}
const blankDesign = await renderDesign("");
for (const total of ["12,000", "25,000", "30,000", "40,000"]) assert.ok(blankDesign.includes(total), "Every standard package is visible before selection");
assert.ok(blankDesign.includes('name="tier" value=""'), "No default package without actual area");
for (const [area, tier] of [["149.999", "under150"], ["150", "under200"], ["200", "under250"], ["250", "upto300"], ["300", "upto300"], ["300.001", "custom"]]) {
  assert.ok((await renderDesign(area)).includes(`name="tier" value="${tier}"`), `Area ${area} matches the server tier`);
}
assert.match((await renderDesign("", { tier: "under150", instalments: ["350000", "350000", "500000"], note: "" })), /<input(?=[^>]*name="usable_area")(?=[^>]*required="")[^>]*>/, "Actual area is required after choosing a package");
const adjusted = await renderDesign("", { tier: "under150", instalments: ["100000", "200000", "300000"], note: "" });
assert.ok(adjusted.includes('name="custom" value="on"') && adjusted.includes('name="instalment_1"') && adjusted.includes('value="1000.00"'), "Previously agreed custom amounts remain active");
console.log("PASS: shared Lead UI, plot opening, design-package boundaries and saved overrides");
// Mocked server rendering only: no browser interactions, HTTP/RLS, server-action execution or physical-device proof.
