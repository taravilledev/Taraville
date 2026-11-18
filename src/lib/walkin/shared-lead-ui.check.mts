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
  filteredLeads: () => ({ range: async () => ({ data: [{ ...lead, stage: "received" }], error: null, count: 1 }) }),
  brandCounts: async () => ({ all: 1, taraville: 0, baanKunapap: 1 }),
};
const mocks: Record<string, unknown> = {
  "server-only": {},
  "next/navigation": { notFound: () => { throw new Error("CHECK_NOT_FOUND"); }, useRouter: () => ({ replace: noop }) },
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
const ListPage = load(new URL("../../app/leads/page.tsx", import.meta.url)).default as Page;
async function render(Page: Page) {
  const errors: unknown[] = [];
  const stream = await renderToReadableStream(createElement(Page, {
    params: Promise.resolve({ id: lead.id }), searchParams: Promise.resolve({ brand: "BAAN_KUNAPAP" }),
  }), { onError: error => { errors.push(error); } });
  await stream.allReady;
  return { html: await new Response(stream).text(), errors };
}
const detailLabels = ["แก้ไขข้อมูล", "บันทึกการติดต่อ", "ยืนยันเปิดโครงการ"];
const manageLabels = ["ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม", "ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม", "ยืนยันปิดรายการ", "ยืนยันเปิดรายการอีกครั้ง", "ยืนยันยกเลิกโครงการ", "เปลี่ยนฝ่ายขายผู้ดูแล"];
const allLabels = [...detailLabels, ...manageLabels];

// Actual async pages and actual status/project/privacy children; only data and server-action boundaries are mocked.
for (const actor of [reader, owner, executive]) {
  staff = actor;
  const detail = await render(DetailPage);
  assert.deepEqual(detail.errors, [], `Detail render failed for ${actor.full_name}`);
  for (const text of ["Shared customer", "Owner Sale", "หญิง"]) assert.ok(detail.html.includes(text), `Shared detail missing ${text}`);
  assert.ok(detail.html.includes("<h2>คำตอบแบบสอบถาม</h2>"), "Survey answers have a visible heading");
  const options = detail.html.match(/<details[^>]*>[\s\S]*?<\/details>/)?.[0] ?? "";
  for (const suffix of ["manage", "history"]) {
    assert.ok(options.includes(`href="/leads/${lead.id}/${suffix}"`), `Lead options must include ${suffix}`);
  }
  assert.ok(!options.includes("คำตอบแบบสอบถาม") && !options.includes("<form"), "Only record links sit in the options menu");
  assert.ok(detail.html.includes("<h2>โครงการ</h2>"));
  const openProjectIndex = detail.html.indexOf('aria-controls="open-project-dialog"');
  assert.equal(openProjectIndex >= 0, actor !== reader, "Only an authorized actor can start a BKP Project");
  if (actor !== reader) assert.ok(openProjectIndex < detail.html.indexOf('href="tel:'), "Project CTA precedes the phone action");
  for (const label of manageLabels) assert.ok(!detail.html.includes(label), `Lead page must not carry manage control ${label}`);
  for (const label of detailLabels) assert.equal(detail.html.includes(label), actor !== reader, `${label} for ${actor.full_name}`);
  const manage = await render(ManagePage);
  assert.deepEqual(manage.errors, [], `Manage render failed for ${actor.full_name}`);
  if (actor === reader) {
    for (const label of allLabels) assert.ok(!manage.html.includes(label), `Nonowner sees mutation control ${label}`);
    assert.ok(manage.html.includes("ลูกค้าไม่ให้ข้อมูลเพิ่มเติม"), "Read-only privacy choice must stay visible");
  } else {
    for (const label of ["ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม", "ยืนยันปิดรายการ"]) assert.ok(manage.html.includes(label), `Authorized actor lost ${label}`);
    assert.equal(manage.html.includes("เปลี่ยนฝ่ายขายผู้ดูแล"), actor === executive, "Only Executive reassigns");
  }
  const history = await render(HistoryPage);
  assert.deepEqual(history.errors, []);
  for (const text of ["historical-evidence-hash", "historical-notice"]) assert.ok(history.html.includes(text), `History missing ${text}`);
  const edit = await render(EditPage);
  if (actor === reader) {
    assert.ok(edit.errors.some(error => error instanceof Error ? error.message === "CHECK_NOT_FOUND" : String(error).includes("CHECK_NOT_FOUND")), "Nonowner edit must invoke notFound");
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

// Read-only closed status and reopen control live on the manage page.
lead = { ...baseLead, closed_at: baseLead.created_at, closed_by: owner.id, closed_reason: "other" };
for (const actor of [reader, owner, executive]) {
  staff = actor;
  const manage = await render(ManagePage);
  assert.deepEqual(manage.errors, []);
  assert.ok(manage.html.includes("Historical close reason") && manage.html.includes("Historical closer"));
  assert.equal(manage.html.includes("ยืนยันเปิดรายการอีกครั้ง"), actor !== reader);
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
  assert.ok(detail.html.includes("BKP-69-123") && detail.html.includes("SC-1"));
  assert.ok(!detail.html.includes("/sales/"), "A row the reader cannot open has no link");
  const manage = await render(ManagePage);
  assert.deepEqual(manage.errors, []);
  assert.ok(manage.html.includes("ลูกค้าเลือกให้ข้อมูลเพิ่มเติม"));
  assert.equal(manage.html.includes("ยืนยันยกเลิกโครงการ"), actor === executive);
  assert.equal(manage.html.includes("ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม"), actor !== reader);
  assert.ok(!manage.html.includes("ยืนยันปิดรายการ"), "Active projects still prevent closing");
}
// Project without a sale offers to start one; a cancelled sale on the Project explains instead of offering a failing button.
staff = owner;
work = { canCreate: true, cases: [] };
assert.ok((await render(DetailPage)).html.includes(`/sales/new?lead=${lead.id}&amp;project=${projectId}`));
work = { canCreate: false, cases: [{ ...row, id: "94000000-0000-4000-a000-000000000001", status: "contracted", can_open: true }] };
const existingProject = (await render(DetailPage)).html;
const existingProjectLink = existingProject.indexOf('href="/sales/94000000-0000-4000-a000-000000000001"');
assert.ok(existingProjectLink >= 0 && existingProject.includes('aria-controls="open-project-dialog"'), "Existing cards open their own Project while the primary CTA still adds another");
assert.equal((existingProject.match(/BKP-69-123/g) ?? []).length, 2, "Project code appears once visually and once in the card accessible name");
assert.ok(existingProject.includes("ดูรายละเอียด"));
projects.push({ ...projects[0], id: "93000000-0000-4000-a000-000000000002", code: "BKP-69-124" });
const multipleProjects = (await render(DetailPage)).html.replace(/<!--.*?-->/g, "");
assert.ok(multipleProjects.includes("2 โครงการ") && multipleProjects.includes("BKP-69-123") && multipleProjects.includes("BKP-69-124"));
projects.pop();
work = { canCreate: false, cases: [{ ...row, id: "94000000-0000-4000-a000-000000000001", status: "cancelled", can_open: true }] };
const cancelledSale = (await render(DetailPage)).html;
assert.ok(cancelledSale.includes("ถูกยกเลิกแล้ว") && !cancelledSale.includes("ดำเนินโครงการต่อ"));

lead = { ...baseLead, brand: "TARAVILLE" };
projects = [];
work = { canCreate: true, cases: [] };
const tv = (await render(DetailPage)).html;
assert.ok(tv.includes("<h2>โครงการ</h2>") && tv.includes("ยังไม่มีโครงการ"));
const tvProjectLink = tv.indexOf(`href="/sales/new?lead=${lead.id}"`);
assert.ok(tvProjectLink >= 0 && tvProjectLink < tv.indexOf('href="tel:'), "Taraville project CTA precedes the phone action");
assert.ok(!tv.includes("เปิดรายการขายใหม่") && !tv.includes("งานของลูกค้า"));
lead = { ...baseLead };

// Execute the real shared query builder and owner roster, without a database or source-text assertions.
const queries = load(new URL("./queries.ts", import.meta.url)) as typeof import("./queries");
const calls: [string, unknown][] = [];
const request = {
  select: () => request, eq: (column: string, value: unknown) => { calls.push([column, value]); return request; },
  neq: () => request, order: () => request,
  then: (resolve: (value: { data: Staff[]; error: null }) => unknown) => Promise.resolve({ data: [owner, reader], error: null }).then(resolve),
};
const querySession = { staff: reader, supabase: { from: () => request } } as unknown as Parameters<typeof queries.filteredLeads>[0];
queries.filteredLeads(querySession, { owner: owner.id, sort: "created", dir: "desc", page: 1 });
assert.deepEqual(calls.find(([column]) => column === "owner_id"), ["owner_id", owner.id], "A Sale can filter another owner");
assert.equal((await queries.saleOwners(querySession)).length, 2, "Sale owner filter roster cannot be restricted to Executive");
const NewCaseForm = load(new URL("../../app/sales/new/new-case-form.tsx", import.meta.url)).NewCaseForm as
  (props: { workspace: SalesBootstrap; lead: SalesBootstrap["leads"][number]; projects: { id: string; code: string }[]; projectId: string; requestId: string }) => ReactNode;
const openingLead: SalesBootstrap["leads"][number] = { id: baseLead.id, brand: "TARAVILLE", full_name: "Opening fixture", owner_id: owner.id, project_id: null, project_code: null };
const openingWorkspace: SalesBootstrap = { actor: { id: owner.id, full_name: owner.full_name, role: "sale" }, cases: [], leads: [openingLead], customers: [], developments: [], staff: [], can_admin: false, can_catalog: false };
async function renderOpening(workspace = openingWorkspace, brand = openingLead.brand) {
  const stream = await renderToReadableStream(createElement(NewCaseForm, { workspace, lead: { ...openingLead, brand }, projects: [{ id: "project", code: "BKP-fixture" }], projectId: "project", requestId: "request" }));
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
assert.equal((availableOpening.match(/role="combobox"/g) ?? []).length, 1, "Only Project is a dropdown; plots are browsed in the table");
assert.ok(availableOpening.includes("<table") && availableOpening.includes('type="search"'));
assert.ok(!availableOpening.includes("<form"), "No create form until a plot is selected");
assert.ok(!availableOpening.includes("Existing fixture") && !availableOpening.includes("checkbox"), "Lead data is used directly with no customer-switch UI");
assert.ok(!(await renderOpening({ ...openingWorkspace, developments: [{ ...development, units: [{ ...development.units[0], is_available: false }] }] })).includes("<form"));
const bkpOpening = await renderOpening(openingWorkspace, "BAAN_KUNAPAP");
assert.ok(bkpOpening.includes('name="project_id"') && bkpOpening.includes("BKP-fixture"));
assert.ok(!bkpOpening.includes('name="unit_id"'), "BKP does not require a property unit");
// Exercise actual table filtering and modal bindings with deterministic parent state.
const fieldFile = new URL("../../app/sales/new/opening-fields.tsx", import.meta.url);
cache.delete(fieldFile.href);
const fieldState: unknown[] = ["", "", null];
let hookIndex = 0;
mocks.react = { useState: () => {
  const index = hookIndex++;
  return [fieldState[index], (value: unknown) => { fieldState[index] = value; }];
}, useRef: () => ({ current: null }), useEffect: noop };
const Fields = load(fieldFile).OpeningFields as (props: { units: typeof fieldUnits; leadId: string; requestId: string }) => ReactNode;
delete mocks.react;
const fieldUnits = [
  { id: "u1", developmentId: "d1", code: "A1", location: "Project 1", address: "Address one", details: { model: "Model one" }, price: "10000" },
  { id: "u2", developmentId: "d2", code: "A1", location: "Project 2", address: "Address two", details: { model: "Model two" }, price: null },
];
async function renderBrowser() {
  hookIndex = 0;
  const stream = await renderToReadableStream(Fields({ units: fieldUnits, leadId: "origin-lead", requestId: "origin-request" }));
  await stream.allReady;
  return new Response(stream).text();
}
const allUnits = await renderBrowser();
assert.ok(allUnits.includes("Model one") && allUnits.includes("Model two"), "Unfiltered table includes every eligible plot");
fieldState[1] = "d2";
const filteredUnits = await renderBrowser();
assert.ok(!filteredUnits.includes("Model one") && filteredUnits.includes("Model two"), "Project filter uses UUID despite duplicate plot code");
fieldState[0] = "  ONE  "; fieldState[1] = "";
const searchedUnits = await renderBrowser();
assert.ok(searchedUnits.includes("Model one") && !searchedUnits.includes("Model two"), "Search trims and ignores case");
fieldState[0] = "not-a-plot";
assert.ok((await renderBrowser()).includes("ไม่พบแปลงที่ตรงกับเงื่อนไข"));
fieldState[0] = ""; fieldState[2] = fieldUnits[1];
const modal = await renderBrowser();
for (const text of ['name="unit_id" value="u2"', 'name="lead_id" value="origin-lead"', 'name="request_id" value="origin-request"', 'name="customer_id" value=""', "Address two", "เปิดโครงการด้วยแปลงนี้", "ยังไม่จองหรือกันแปลง"]) assert.ok(modal.includes(text), `Modal missing ${text}`);
assert.equal((modal.match(/<form/g) ?? []).length, 1, "Only the selected plot modal submits; no nested forms");
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
