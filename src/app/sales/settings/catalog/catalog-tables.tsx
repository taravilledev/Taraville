import { randomUUID } from "node:crypto";
import type { SalesBootstrap } from "@/lib/sales/models";
import { formatMoney } from "@/lib/sales/money";
import { ActionForm } from "@/app/walkin/action-form";
import { DataRow, DataTable, RowLink } from "@/components/data-table";
import { Drawer } from "@/components/drawer";
import { Status, type StatusTone } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { noteClass } from "../settings-styles";
import { unitStatus } from "./catalog-list";
import { setUnitActivity } from "./unit-activity";
import { UnitForm } from "./unit-form";

export const statusLabels = { available: "ว่าง", reserved: "กันไว้แล้ว", inactive: "ปิดใช้งาน" };
const statusTones: Record<keyof typeof statusLabels, StatusTone> = { available: "success", reserved: "progress", inactive: "inactive" };
type Development = SalesBootstrap["developments"][number];
type Unit = Development["units"][number];
const text = (unit: Unit, key: string) => typeof unit.details[key] === "string" ? unit.details[key] as string : "";

export function ProjectTable({ developments, base }: { developments: Development[]; base: string }) {
  return <DataTable label="รายการโครงการหมู่บ้าน">
    <thead><tr><th scope="col">โครงการหมู่บ้าน</th><th scope="col">บ้าน/แปลง</th><th scope="col">สถานะ</th></tr></thead>
    <tbody>{developments.map(item => {
      const free = item.units.filter(unit => unitStatus(item.is_active, unit) === "available").length;
      return <DataRow key={item.id}>
        <td><RowLink href={base + "?project=" + item.id} className="font-bold text-foreground">{item.name}</RowLink>
          {item.address && <small className="block text-muted-foreground">{item.address}</small>}</td>
        <td>{item.units.length} แปลง<span className="text-muted-foreground"> · ว่าง {free}</span></td>
        <td><Status tone={item.is_active ? "success" : "inactive"}>{item.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Status></td>
      </DataRow>;
    })}</tbody>
  </DataTable>;
}

export function UnitTable({ development, units, canEdit, filter }: {
  development: Development; units: Unit[]; canEdit: boolean; filter: { q: string; status: string; page: number };
}) {
  return <DataTable label="ทะเบียนบ้านและแปลง">
    <thead><tr><th scope="col">บ้าน/แปลง</th><th scope="col">แบบบ้าน</th><th scope="col">พื้นที่ใช้สอย · ที่ดิน</th><th scope="col">ราคาทะเบียน (บาท)</th><th scope="col">สถานะ</th>{canEdit && <th scope="col">ดำเนินการ</th>}</tr></thead>
    <tbody>{units.map(item => {
      const state = unitStatus(development.is_active, item);
      const detail = [text(item, "layout"), text(item, "build_status")].filter(Boolean).join(" · ");
      return <DataRow key={item.id}>
        <td className="font-bold">{item.code}</td>
        <td>{text(item, "model") || "—"}{detail && <small className="block text-muted-foreground">{detail}</small>}</td>
        <td>{text(item, "usable_area") || "—"} ตร.ม. · {text(item, "land_area") || "—"} ตร.ว.</td>
        <td className="tabular-nums">{item.list_price_cents != null ? formatMoney(item.list_price_cents) : "—"}</td>
        <td><Status tone={statusTones[state]}>{statusLabels[state]}</Status></td>
        {canEdit && <td><Drawer name={`unit-${item.id}`} title={"แก้ไขบ้าน/แปลง " + item.code}
          trigger={<button type="button" className={cn(buttonVariants({ variant: "outline", size: "auto" }), "relative z-2")} aria-label={"แก้ไขบ้าน/แปลง " + item.code}>แก้ไข</button>}>
          <div className="grid gap-4">
            <UnitForm developmentId={development.id} unit={item} requestId={randomUUID()} />
            {development.is_active ? <ActionForm inline action={setUnitActivity.bind(null, {
              projectId: development.id, unitId: item.id, version: item.version, requestId: randomUUID(),
              active: !item.is_active, ...filter,
            })} label={item.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}>{null}</ActionForm>
              : <p role="note" className={noteClass}><strong>เปลี่ยนสถานะรายแปลงไม่ได้</strong> · เปิดใช้งานโครงการก่อนจึงเปิดหรือปิดบ้าน/แปลงได้</p>}
          </div>
        </Drawer></td>}
      </DataRow>;
    })}</tbody>
  </DataTable>;
}
