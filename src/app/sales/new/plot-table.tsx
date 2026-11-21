import Link from "next/link";
import { ActionForm } from "@/app/walkin/action-form";
import { formatMoney } from "@/lib/sales/money";
import { createCase } from "../actions";
import { DataRow, DataTable } from "@/components/data-table";
import { Drawer } from "@/components/drawer";
import { factsClass } from "@/components/facts";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export type Plot = { id: string; developmentId: string; code: string; location: string; address: string; details: Record<string, unknown>; price: string | null };
const detail = (plot: Plot, key: string) => typeof plot.details[key] === "string" && plot.details[key] ? plot.details[key] as string : "ยังไม่ระบุ";
const price = (plot: Plot) => plot.price === null ? "ยังไม่ระบุ" : formatMoney(plot.price);
const rowLinkClass = "font-bold text-foreground no-underline after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-primary focus-visible:after:-outline-offset-2";

/** Free-plot picker: search and development filter come from the URL (`q`, `dev`), each row opens a drawer that creates the draft. */
export function PlotTable({ plots, leadId, requestId, q, dev, baseHref }: {
  plots: Plot[]; leadId: string; requestId: string; q: string; dev: string; baseHref: string;
}) {
  const developments = [...new Map(plots.map(plot => [plot.developmentId, plot.location])).entries()];
  const search = q.trim().toLocaleLowerCase();
  const matches = plots.filter(plot => (!dev || plot.developmentId === dev) && `${plot.code} ${detail(plot, "model")}`.toLocaleLowerCase().includes(search));
  return <div className="grid gap-4">
    <form method="get" action="/sales/new" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="lead" value={leadId} />
      <Field className="min-w-48 flex-1"><FieldLabel htmlFor="plot-q">ค้นหาแปลงหรือแบบบ้าน</FieldLabel>
        <Input id="plot-q" type="search" name="q" defaultValue={q} placeholder="เลขแปลง หรือชื่อแบบบ้าน" /></Field>
      <Field><FieldLabel htmlFor="plot-dev">โครงการ</FieldLabel>
        <NativeSelect id="plot-dev" name="dev" defaultValue={dev}><option value="">ทุกโครงการ</option>
          {developments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</NativeSelect></Field>
      <button type="submit" className={buttonVariants({ variant: "outline" })}>ค้นหา</button>
    </form>
    <p role="status" className="m-0 text-sm text-muted-foreground">{matches.length} จาก {plots.length} แปลงว่าง</p>
    {!matches.length ? <div className="rounded-md bg-accent p-6 text-center [&_p]:mb-0 [&_p]:text-muted-foreground">
      <strong>ไม่พบแปลงที่ตรงกับเงื่อนไข</strong>
      <p><Link className="text-primary underline-offset-4 hover:underline" href={baseHref} prefetch={false}>ล้างตัวกรอง</Link></p>
    </div> : <DataTable label="แปลงว่างที่เปิดโครงการได้">
      <thead><tr><th scope="col">แปลง</th><th scope="col">โครงการ</th><th scope="col">แบบบ้าน</th><th scope="col">เนื้อที่ดิน (ตร.ว.)</th><th scope="col">ราคาทะเบียน (บาท)</th></tr></thead>
      <tbody>{matches.map(plot => <DataRow key={plot.id}>
        <td><Drawer name={`unit-${plot.id}`} title={`แปลง ${plot.code} · ${plot.location}`}
          trigger={<button type="button" className={rowLinkClass}>{plot.code}</button>}>
          <PlotDrawerBody plot={plot} leadId={leadId} requestId={requestId} />
        </Drawer></td>
        <td>{plot.location}</td><td>{detail(plot, "model")}</td><td>{detail(plot, "land_area")}</td><td className="tabular-nums">{price(plot)}</td>
      </DataRow>)}</tbody>
    </DataTable>}
  </div>;
}

function PlotDrawerBody({ plot, leadId, requestId }: { plot: Plot; leadId: string; requestId: string }) {
  return <ActionForm action={createCase} label="เปิดโครงการด้วยแปลงนี้">
    <dl className="m-0 mb-4 [&_dd]:m-0 [&_dd]:mt-1 [&_dd]:text-lg [&_dd]:font-bold [&_dt]:text-sm [&_dt]:text-muted-foreground"><dt>ราคาทะเบียน</dt><dd>{plot.price === null ? "ยังไม่ระบุ" : `${formatMoney(plot.price)} บาท`}</dd></dl>
    <dl className={cn(factsClass, "m-0")}>
      {[["model", "แบบบ้าน"], ["land_area", "เนื้อที่ดิน (ตร.ว.)"], ["usable_area", "พื้นที่ใช้สอย (ตร.ม.)"], ["build_status", "สถานะก่อสร้าง"]].map(([key, label]) =>
        <div key={key}><dt>{label}</dt><dd>{detail(plot, key)}</dd></div>)}
    </dl>
    <dl className={cn(factsClass, "mt-4 border-t pt-4 [&_dd]:font-normal")}>
      <div><dt>ที่ตั้งโครงการ</dt><dd>{plot.address || "ยังไม่ระบุ"}</dd></div>
      <div><dt>ฟังก์ชันภายใน</dt><dd>{detail(plot, "layout")}</dd></div>
    </dl>
    <input type="hidden" name="lead_id" value={leadId} /><input type="hidden" name="unit_id" value={plot.id} />
    <input type="hidden" name="request_id" value={requestId} /><input type="hidden" name="project_id" value="" /><input type="hidden" name="customer_id" value="" />
    <p className="m-0 mt-4 border-t pt-4 text-sm text-foreground">เปิดเป็นร่าง ยังไม่จองหรือกันแปลง</p>
  </ActionForm>;
}
