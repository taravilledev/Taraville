import Link from "next/link";
import { Phone } from "lucide-react";
import type { ListLead } from "@/lib/walkin/models";
import { budgetOf, listHref, relativeDays, type LeadFilters } from "@/lib/walkin/lead-list";
import { STAGE_LABELS } from "@/lib/walkin/lead-stage";
import styles from "./leads.module.css";

const thaiDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

function SortHeader({ filters, column, label }: { filters: LeadFilters; column: "created" | "contact"; label: string }) {
  const isActive = filters.sort === column;
  const nextDir = isActive && filters.dir === "desc" ? "asc" : "desc";
  return <Link className={styles.sortLink} prefetch={false} href={listHref(filters, { sort: column, dir: nextDir, page: undefined })}
    aria-sort={isActive ? (filters.dir === "asc" ? "ascending" : "descending") : undefined}>
    {label}{isActive ? (filters.dir === "asc" ? " ↑" : " ↓") : ""}</Link>;
}

export function LeadTable({ leads, filters, ownerName }: { leads: ListLead[]; filters: LeadFilters; ownerName?: Map<string, string> }) {
  const columns = ownerName ? styles.withOwner : "";
  return <div className={`${styles.table} ${columns}`}>
    <div className={styles.headRow}>
      <span>ชื่อ</span><span>สถานะ</span><span>เบอร์โทร</span><span>แบรนด์</span><span>งบ</span>
      <SortHeader filters={filters} column="contact" label="ติดต่อล่าสุด" />
      <SortHeader filters={filters} column="created" label="บันทึกเมื่อ" />
      {ownerName && <span>ผู้ดูแล</span>}
    </div>
    {leads.map(lead => <div key={lead.id} className={styles.row}>
      <Link className={styles.name} href={`/leads/${lead.id}`} prefetch={false}>
        {`${lead.name_title} ${lead.first_name} ${lead.last_name}`.replace(/\s+/g, " ").trim()}
        {lead.privacy_mode === "synthetic" && <small> · ข้อมูลสมมติ</small>}
        </Link>
      <span className={styles.stage}>{STAGE_LABELS[lead.stage]}</span>
      <a className={styles.phone} href={`tel:${lead.phone}`}><Phone size={14} aria-hidden="true" />{lead.phone}</a>
      <span className={`${styles.brand} ${lead.brand === "TARAVILLE" ? styles.brandTv : styles.brandBk}`}>
        <span className={styles.brandShort}>{lead.brand === "TARAVILLE" ? "TV" : "BK"}</span>
        <span className={styles.brandFull}>{lead.brand === "TARAVILLE" ? "ธาราวิล" : "บ้านคุณภาพ"}</span></span>
      <span className={styles.budget}>{budgetOf(lead)}</span>
      <span className={styles.contact} title={lead.last_contact_at ? thaiDate(lead.last_contact_at) : undefined}>{relativeDays(lead.last_contact_at)}</span>
      <span className={styles.created}>{thaiDate(lead.created_at)}</span>
      {ownerName && <span className={styles.owner}>{ownerName.get(lead.owner_id) ?? "ผู้ดูแลเดิม"}</span>}
    </div>)}
  </div>;
}
