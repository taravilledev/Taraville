import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";
import type { ListLead } from "@/lib/walkin/models";
import { budgetOf, relativeDays } from "@/lib/walkin/lead-list";
import { STAGE_LABELS } from "@/lib/walkin/lead-stage";
import styles from "./leads.module.css";

const thaiDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

type Props = { leads: ListLead[]; projectCodes: Map<string, string>; ownerName?: Map<string, string> };

export function LeadCards({ leads, projectCodes, ownerName }: Props) {
  return <ul className={styles.cards}>
    {leads.map(lead => {
      const projectCode = projectCodes.get(lead.id);
      return <li key={lead.id} className={styles.card}>
        <div className={styles.cardMain}>
          <div className={styles.cardTitle}>
            <Link className={styles.name} href={`/leads/${lead.id}`} prefetch={false}>
              {`${lead.name_title} ${lead.first_name} ${lead.last_name}`.replace(/\s+/g, " ").trim()}</Link>
            <span className={`${styles.brand} ${lead.brand === "TARAVILLE" ? styles.brandTv : styles.brandBk}`}>
              {lead.brand === "TARAVILLE" ? "ธาราวิล" : "บ้านคุณภาพ"}</span>
            <span className={styles.stage}>{STAGE_LABELS[lead.stage]}</span>
            {projectCode && <span className={styles.projectTag}>{projectCode}</span>}
            {lead.privacy_mode === "synthetic" && <span className={styles.stage}>ข้อมูลสมมติ</span>}
          </div>
          <p className={styles.meta}>
            <span className={styles.metaPhone}><Phone size={14} aria-hidden="true" />{lead.phone}</span>
            {lead.line_id && <span className={styles.metaLine}><MessageSquare size={14} aria-hidden="true" />LINE: {lead.line_id}</span>}
            <span>ลงทะเบียน: {thaiDate(lead.created_at)}</span>
            <span title={lead.last_contact_at ? thaiDate(lead.last_contact_at) : undefined}>ติดต่อล่าสุด: {relativeDays(lead.last_contact_at)}</span>
          </p>
          <p className={styles.meta}>
            <span>งบประมาณ: <strong>{budgetOf(lead)}</strong></span>
            {ownerName && <span>ผู้ดูแล: {ownerName.get(lead.owner_id) ?? "ผู้ดูแลเดิม"}</span>}
          </p>
        </div>
        <a className={styles.callButton} href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}><Phone size={14} aria-hidden="true" />โทร</a>
      </li>;
    })}
  </ul>;
}
