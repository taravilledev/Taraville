import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";
import type { ListLead } from "@/lib/walkin/models";
import { budgetOf, relativeDays } from "@/lib/walkin/lead-list";
import { STAGE_LABELS } from "@/lib/walkin/lead-stage";
import styles from "./leads.module.css";

const thaiDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

type Props = { leads: ListLead[]; workTags: Map<string, string>; ownerName?: Map<string, string> };

export function LeadCards({ leads, workTags, ownerName }: Props) {
  return <ul className={styles.cards}>
    {leads.map(lead => {
      const workTag = workTags.get(lead.id);
      const name = [lead.name_title, lead.first_name, lead.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      return <li key={lead.id} className={styles.card}>
        <div className={styles.cardMain}>
          <Link className={styles.name} href={`/leads/${lead.id}`} prefetch={false}>{name}</Link>
          <div className={styles.cardTags}>
            <span className={`${styles.brand} ${lead.brand === "TARAVILLE" ? styles.brandTv : styles.brandBk}`}>
              {lead.brand === "TARAVILLE" ? "ธาราวิล" : "บ้านคุณภาพ"}</span>
            <span className={styles.stage}>{STAGE_LABELS[lead.stage]}</span>
            {workTag && <span className={styles.projectTag}>{workTag}</span>}
            {lead.privacy_mode === "synthetic" && <span className={styles.stage}>ข้อมูลสมมติ</span>}
          </div>
        </div>
        <div className={styles.contact}>
          <span className={styles.metaPhone}><Phone size={14} aria-hidden="true" />{lead.phone}</span>
          {lead.line_id && <span className={styles.metaLine}><MessageSquare size={14} aria-hidden="true" /><span>LINE: {lead.line_id}</span></span>}
        </div>
        <dl className={styles.meta}>
          {ownerName && <div><dt>ผู้ดูแล</dt><dd>{ownerName.get(lead.owner_id) ?? "ผู้ดูแลเดิม"}</dd></div>}
          <div><dt>งบประมาณ</dt><dd>{budgetOf(lead)}</dd></div>
          <div><dt>ลงทะเบียน</dt><dd><time dateTime={lead.created_at}>{thaiDate(lead.created_at)}</time></dd></div>
          <div><dt>ติดต่อล่าสุด</dt><dd>{lead.last_contact_at
            ? <><time dateTime={lead.last_contact_at}>{thaiDate(lead.last_contact_at)}</time><small> · {relativeDays(lead.last_contact_at)}</small></>
            : relativeDays(lead.last_contact_at)}</dd></div>
        </dl>
        <a className={styles.callButton} href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} aria-label={`โทรหา ${name}`}><Phone size={14} aria-hidden="true" />โทร</a>
      </li>;
    })}
  </ul>;
}
