import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";
import type { ListLead } from "@/lib/walkin/models";
import { budgetOf, relativeDays } from "@/lib/walkin/lead-list";
import { STAGE_LABELS } from "@/lib/walkin/lead-stage";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const cardClass = "relative grid grid-cols-[minmax(0,1.4fr)_minmax(0,.85fr)_minmax(0,1.6fr)_auto] items-start gap-4 border-t p-4 [overflow-wrap:anywhere] first:rounded-t-lg first:border-t-0 last:rounded-b-lg hover:bg-tint @max-[850px]/lead-list:grid-cols-2 @max-[510px]/lead-list:grid-cols-1 @max-[510px]/lead-list:gap-3";
const stackClass = "grid min-w-0 justify-items-start gap-2";
const tagClass = "rounded-sm px-2 py-0 font-semibold text-muted-foreground";

const thaiDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

type Props = { leads: ListLead[]; workTags: Map<string, string>; ownerName?: Map<string, string> };

export function LeadCards({ leads, workTags, ownerName }: Props) {
  return <ul className="m-0 list-none rounded-lg border bg-card p-0 @container/lead-list">
    {leads.map(lead => {
      const workTag = workTags.get(lead.id);
      const name = [lead.name_title, lead.first_name, lead.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      return <li key={lead.id} className={cardClass}>
        <div className={stackClass}>
          <Link className="text-md font-bold text-foreground no-underline after:absolute after:inset-0 after:content-['']" href={`/leads/${lead.id}`} prefetch={false}>{name}</Link>
          <div className="flex flex-wrap items-center gap-1">
            <Badge className={cn("px-3 font-bold", lead.brand === "TARAVILLE" ? "bg-brand-tv-tint text-brand-tv" : "bg-brand-bk-tint text-brand-bk")}>
              {lead.brand === "TARAVILLE" ? "ธาราวิล" : "บ้านคุณภาพ"}</Badge>
            <Badge variant="secondary" className={tagClass}>{STAGE_LABELS[lead.stage]}</Badge>
            {workTag && <Badge variant="secondary" className={cn(tagClass, "text-primary")}>{workTag}</Badge>}
            {lead.privacy_mode === "synthetic" && <Badge variant="secondary" className={tagClass}>ข้อมูลสมมติ</Badge>}
          </div>
        </div>
        <div className={stackClass}>
          <span className="inline-flex min-w-0 items-baseline gap-2 text-sm font-semibold tabular-nums"><Phone size={14} className="shrink-0 self-center" aria-hidden="true" />{lead.phone}</span>
          {lead.line_id && <span className="inline-flex min-w-0 items-baseline gap-2 text-sm text-primary"><MessageSquare size={14} className="shrink-0 self-center" aria-hidden="true" /><span>LINE: {lead.line_id}</span></span>}
        </div>
        <dl className="m-0 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-sm [&_dd]:m-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_small]:text-xs [&_small]:text-muted-foreground">
          {ownerName && <div><dt>ผู้ดูแล</dt><dd>{ownerName.get(lead.owner_id) ?? "ผู้ดูแลเดิม"}</dd></div>}
          <div><dt>งบประมาณ</dt><dd>{budgetOf(lead)}</dd></div>
          <div><dt>ลงทะเบียน</dt><dd><time dateTime={lead.created_at}>{thaiDate(lead.created_at)}</time></dd></div>
          <div><dt>ติดต่อล่าสุด</dt><dd>{lead.last_contact_at
            ? <><time dateTime={lead.last_contact_at}>{thaiDate(lead.last_contact_at)}</time><small> · {relativeDays(lead.last_contact_at)}</small></>
            : relativeDays(lead.last_contact_at)}</dd></div>
        </dl>
        <a className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative z-10 justify-self-start no-underline @max-[850px]/lead-list:self-end @max-[850px]/lead-list:justify-self-end")} href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} aria-label={`โทรหา ${name}`}><Phone size={14} aria-hidden="true" />โทร</a>
      </li>;
    })}
  </ul>;
}
