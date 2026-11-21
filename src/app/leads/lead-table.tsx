import type { ListLead } from "@/lib/walkin/models";
import { budgetOf, listHref, relativeDays, type LeadFilters } from "@/lib/walkin/lead-list";
import { STAGE_GROUP_TONES, stageGroupLabel, stageGroupOf } from "@/lib/walkin/lead-stage";
import { BrandTag } from "@/components/brand-tag";
import { DataRow, DataTable, RowLink, SortHeader } from "@/components/data-table";
import { Status } from "@/components/status";
import { Badge } from "@/components/ui/badge";

const full = "@max-[768px]/data-table:basis-full";
const label = "hidden text-muted-foreground @max-[768px]/data-table:inline";
const thaiDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

type Props = { leads: ListLead[]; workTags: Map<string, string>; ownerName: Map<string, string>; filters: LeadFilters };

export function LeadTable({ leads, workTags, ownerName, filters }: Props) {
  return <DataTable label="รายการ Lead">
    <thead><tr>
      <th scope="col">ชื่อ · เบอร์โทร</th><th scope="col">แบรนด์</th><th scope="col">ขั้น</th><th scope="col">โครงการ</th><th scope="col">ผู้ดูแล</th><th scope="col">งบ / ค่างวด</th>
      <SortHeader direction={filters.dir} href={listHref(filters, { dir: filters.dir === "desc" ? "asc" : "desc", page: undefined })}>ลงทะเบียน</SortHeader>
    </tr></thead>
    <tbody>
      {leads.map(lead => {
        const name = [lead.name_title, lead.first_name, lead.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
        const workTag = workTags.get(lead.id);
        return <DataRow key={lead.id}>
          <td className={full}>
            <RowLink className="block font-semibold text-foreground" href={`/leads/${lead.id}`}>{name}</RowLink>
            <span className="text-xs text-muted-foreground tabular-nums">{lead.phone}</span>
            {lead.privacy_mode === "synthetic" && <Badge variant="secondary" className="ml-2 rounded-sm px-2 py-0 font-semibold text-muted-foreground">ข้อมูลสมมติ</Badge>}
          </td>
          <td><BrandTag brand={lead.brand} /></td>
          <td><Status tone={STAGE_GROUP_TONES[stageGroupOf(lead.stage)]}>{stageGroupLabel(lead.stage)}</Status></td>
          <td className={workTag ? undefined : "@max-[768px]/data-table:hidden"}>{workTag ? <Status tone="progress">{workTag}</Status> : <span className="text-muted-foreground">—</span>}</td>
          <td className={`whitespace-nowrap ${full}`}><span className={label}>ผู้ดูแล </span>{ownerName.get(lead.owner_id) ?? "ผู้ดูแลเดิม"}</td>
          <td className={`whitespace-nowrap ${full}`}>{budgetOf(lead)}</td>
          <td className={`whitespace-nowrap tabular-nums ${full}`}>
            <span className={label}>ลงทะเบียน </span><time dateTime={lead.created_at}>{thaiDate(lead.created_at)}</time>
            <span className="block text-xs text-muted-foreground @max-[768px]/data-table:inline"> {relativeDays(lead.created_at)}</span>
          </td>
        </DataRow>;
      })}
    </tbody>
  </DataTable>;
}
