import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import ts from "typescript";
import type { Lead, Project, Staff } from "./models";
import type { PrivacyEvent } from "./privacy";

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
  brandCounts: async () => ({ all: 1, taraville: 0, baanKunapap: 1 }), activeProjectCodes: async () => new Map(),
};
const mocks: Record<string, unknown> = {
  "server-only": {},
  "next/navigation": { notFound: () => { throw new Error("CHECK_NOT_FOUND"); }, useRouter: () => ({ replace: noop }) },
  "next/link": ({ href, children }: { href: string; children?: ReactNode }) => createElement("a", { href }, children),
  "@/lib/walkin/queries": pageQueries,
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
      reassignLead: noop, recordPrivacy: noop, closeLead: noop, reopenLead: noop, openProject: noop, cancelProject: noop,
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
const ListPage = load(new URL("../../app/leads/page.tsx", import.meta.url)).default as Page;
async function render(Page: Page) {
  const errors: unknown[] = [];
  const stream = await renderToReadableStream(createElement(Page, {
    params: Promise.resolve({ id: lead.id }), searchParams: Promise.resolve({ brand: "BAAN_KUNAPAP" }),
  }), { onError: error => { errors.push(error); } });
  await stream.allReady;
  return { html: await new Response(stream).text(), errors };
}
const mutationLabels = ["แก้ไขข้อมูล", "ยืนยันบันทึกการติดต่อ", "ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม", "ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม",
  "ยืนยันปิดรายการ", "ยืนยันเปิดรายการอีกครั้ง", "ยืนยันเปิดโครงการ", "ยืนยันยกเลิกโครงการ", "เปลี่ยนฝ่ายขายผู้ดูแล"];

// Actual async page and actual status/project/privacy children; only data and server-action boundaries are mocked.
for (const actor of [reader, owner, executive]) {
  staff = actor;
  const detail = await render(DetailPage);
  assert.deepEqual(detail.errors, [], `Detail render failed for ${actor.full_name}`);
  for (const text of ["Shared customer", "Owner Sale", "หญิง", "historical-evidence-hash", "historical-notice"]) {
    assert.ok(detail.html.includes(text), `Shared detail missing ${text}`);
  }
  if (actor === reader) {
    for (const label of mutationLabels) assert.ok(!detail.html.includes(label), `Nonowner sees mutation control ${label}`);
    assert.ok(detail.html.includes("ลูกค้าไม่ให้ข้อมูลเพิ่มเติม"), "Read-only privacy choice must stay visible");
  } else {
    for (const label of ["แก้ไขข้อมูล", "ยืนยันบันทึกการติดต่อ", "ยืนยันตัวเลือกให้ข้อมูลเพิ่มเติม", "ยืนยันปิดรายการ", "ยืนยันเปิดโครงการ"]) {
      assert.ok(detail.html.includes(label), `Authorized actor lost ${label}`);
    }
    assert.equal(detail.html.includes("เปลี่ยนฝ่ายขายผู้ดูแล"), actor === executive, "Only Executive reassigns");
  }
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

// Read-only closed status and project history remain visible; authorization gates their actual forms.
lead = { ...baseLead, closed_at: baseLead.created_at, closed_by: owner.id, closed_reason: "other" };
for (const actor of [reader, owner, executive]) {
  staff = actor;
  const detail = await render(DetailPage);
  assert.deepEqual(detail.errors, []);
  assert.ok(detail.html.includes("Historical close reason") && detail.html.includes("Historical closer"));
  assert.equal(detail.html.includes("ยืนยันเปิดรายการอีกครั้ง"), actor !== reader);
}
lead = { ...baseLead };
projects = [{ id: "93000000-0000-4000-a000-000000000001", lead_id: lead.id, code: "BKP-69-123", status: "active",
  version: 1, created_at: lead.created_at, cancelled_at: null, cancelled_by: null, cancel_reason: null }];
events = [{ ...events[0], survey_consent: true }];
for (const actor of [reader, owner, executive]) {
  staff = actor;
  const detail = await render(DetailPage);
  assert.deepEqual(detail.errors, []);
  assert.ok(detail.html.includes("BKP-69-123") && detail.html.includes("ลูกค้าเลือกให้ข้อมูลเพิ่มเติม"));
  assert.equal(detail.html.includes("ยืนยันยกเลิกโครงการ"), actor === executive);
  assert.equal(detail.html.includes("ยืนยันถอนตัวเลือกและล้างคำตอบเพิ่มเติม"), actor !== reader);
  assert.ok(!detail.html.includes("ยืนยันปิดรายการ"), "Active projects still prevent closing");
}

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
console.log("PASS: shared detail/list rendering, read-only controls, edit-page authorization, shared owner filters and preserved Executive-only controls");
// Mocked server rendering only: no browser interactions, HTTP/RLS, server-action execution or physical-device proof.
