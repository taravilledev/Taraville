import { checkRowClass } from "@/components/check-row";
import { factsClass } from "@/components/facts";
import { formCardClass, formHintClass } from "@/components/form-card";
import { Notice } from "@/components/notice";
import { pageHeaderClass } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { tabLinksClass } from "@/components/tab-links";
import { Tag } from "@/components/tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const unitOptions = [
  { id: "a1", label: "แปลง A1", detail: "ธาราวิล · 50 ตร.ว. · ว่าง", search: "a1 a-1" },
  { id: "a2", label: "แปลง A2", detail: "ธาราวิล · 52 ตร.ว. · จอง", search: "a2 a-2" },
  { id: "b7", label: "แปลง B7", detail: "ธาราวิล · 60 ตร.ว. · ว่าง", search: "b7 b-7" },
  { id: "h3", label: "บ้านเดี่ยว H3", detail: "บ้านคุณภาพ · 3 ห้องนอน", search: "h3" },
];

// Every primitive in src/components/ui is shown here; add new ones with their first use.
export function Primitives() {
  return <>
    <Block title="Button">
      <div className="flex flex-wrap items-center gap-3">
        <Button>ปุ่มหลัก</Button>
        <Button variant="secondary">รอง</Button>
        <Button variant="outline">เส้นขอบ</Button>
        <Button variant="ghost">โปร่ง</Button>
        <Button variant="link">ลิงก์</Button>
        <Button variant="destructive">ลบ</Button>
        <Button size="sm">เล็ก (tap-min)</Button>
        <Button disabled>ปิดใช้งาน</Button>
      </div>
    </Block>

    <Block title="Field · Input · Textarea · NativeSelect">
      <FieldGroup className="max-w-md">
        <Field>
          <FieldLabel htmlFor="ds-name">ชื่อ</FieldLabel>
          <Input id="ds-name" placeholder="ชื่อ-นามสกุล" />
          <FieldDescription>ช่องกรอกสูง --control-h และตัวอักษร text-md</FieldDescription>
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor="ds-phone">เบอร์โทร</FieldLabel>
          <Input id="ds-phone" aria-invalid defaultValue="081" />
          <FieldError>เบอร์โทรต้องมี 10 หลัก</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="ds-note">หมายเหตุ</FieldLabel>
          <Textarea id="ds-note" placeholder="รายละเอียดเพิ่มเติม" />
        </Field>
        <Field>
          <FieldLabel htmlFor="ds-brand">แบรนด์</FieldLabel>
          <NativeSelect id="ds-brand" defaultValue="tv" className="w-full">
            <NativeSelectOption value="tv">ธาราวิล</NativeSelectOption>
            <NativeSelectOption value="bk">บ้านคุณภาพ</NativeSelectOption>
          </NativeSelect>
        </Field>
      </FieldGroup>
    </Block>

    <Block title="Combobox (Popover + Command)">
      <FieldGroup className="max-w-md">
        <Field>
          <FieldLabel htmlFor="ds-unit">แปลง / บ้าน</FieldLabel>
          <Combobox id="ds-unit" name="unit" options={unitOptions} placeholder="เลือกแปลง" />
        </Field>
        <Field>
          <FieldLabel htmlFor="ds-unit-required">จำเป็นต้องเลือก</FieldLabel>
          <Combobox id="ds-unit-required" name="unitRequired" options={unitOptions} placeholder="เลือกแปลง" required />
        </Field>
      </FieldGroup>
    </Block>

    <Block title="Checkbox · RadioGroup">
      <div className="flex flex-wrap gap-8">
        <Field orientation="horizontal" className="w-fit">
          <Checkbox id="ds-consent" defaultChecked />
          <FieldLabel htmlFor="ds-consent">ยินยอมให้เก็บข้อมูล</FieldLabel>
        </Field>
        <RadioGroup defaultValue="a">
          <Field orientation="horizontal" className="w-fit"><RadioGroupItem id="ds-a" value="a" /><FieldLabel htmlFor="ds-a">ตัวเลือก ก</FieldLabel></Field>
          <Field orientation="horizontal" className="w-fit"><RadioGroupItem id="ds-b" value="b" /><FieldLabel htmlFor="ds-b">ตัวเลือก ข</FieldLabel></Field>
        </RadioGroup>
      </div>
    </Block>

    <Block title="Badge">
      <div className="flex flex-wrap gap-2">
        <Badge>default</Badge>
        <Badge variant="secondary">secondary</Badge>
        <Badge variant="outline">outline</Badge>
        <Badge variant="destructive">destructive</Badge>
        <Badge className="bg-brand-tv-tint text-brand-tv">ธาราวิล</Badge>
        <Badge className="bg-brand-bk-tint text-brand-bk">บ้านคุณภาพ</Badge>
      </div>
    </Block>

    <Block title="Table">
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>ผู้สนใจ</TableHead><TableHead>แบรนด์</TableHead><TableHead className="text-right">งบ (บาท)</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>สมชาย ใจดี</TableCell><TableCell>ธาราวิล</TableCell><TableCell className="text-right">2,500,000</TableCell></TableRow>
            <TableRow><TableCell>สมหญิง รักบ้าน</TableCell><TableCell>บ้านคุณภาพ</TableCell><TableCell className="text-right">3,200,000</TableCell></TableRow>
          </TableBody>
        </Table>
      </div>
    </Block>

    <Block title="Dialog (native dialog element)">
      <Dialog>
        <DialogTrigger asChild><Button variant="outline">เปิดหน้าต่าง</Button></DialogTrigger>
        <DialogContent title="ตัวอย่างหน้าต่าง" description="ปุ่ม ESC หรือคลิกพื้นหลังเพื่อปิด">
          <p>เนื้อหาในหน้าต่าง</p>
        </DialogContent>
      </Dialog>
    </Block>

    <Block title="Panel · Page header · Tag · Facts">
      <Panel>
        <header className={pageHeaderClass}>
          <div>
            <h3 className="text-title font-bold">โครงการตัวอย่าง</h3>
            <p>สรุปข้อมูลสำหรับฝ่ายขาย</p>
          </div>
          <Tag>ร่าง</Tag>
        </header>
        <dl className={factsClass}>
          <div>
            <dt>แปลง</dt>
            <dd>A1</dd>
          </div>
          <div>
            <dt>แบรนด์</dt>
            <dd>ธาราวิล</dd>
          </div>
        </dl>
      </Panel>
    </Block>

    <Block title="Form card · Hint">
      <div className={formCardClass}>
        <p className={formHintClass}>กรอกข้อมูลติดต่อของผู้สนใจก่อนบันทึก</p>
      </div>
    </Block>

    <Block title="Notice · Check row">
      <Notice>โปรดตรวจสอบข้อมูลก่อนส่งใบเสนอราคา</Notice>
      <label className={checkRowClass}>
        <input type="checkbox" />
        ตรวจสอบข้อมูลแล้ว
      </label>
    </Block>

    <Block title="Tab links">
      <nav className={tabLinksClass} aria-label="ตัวอย่างลิงก์แท็บ">
        <a href="/design-system" aria-current="page">Design system</a>
        <a href="/dashboard">แดชบอร์ด</a>
      </nav>
    </Block>
  </>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-3" aria-label={title}>
    <h2 className="text-lg font-bold">{title}</h2>
    {children}
  </section>;
}
