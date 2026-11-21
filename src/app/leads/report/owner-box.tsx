"use client";

import { useState } from "react";
import type { MonthlyReport } from "@/lib/walkin/monthly-report";
import { CountRow, ReportBox } from "./report-box";

const LIMIT = 5;

// Top five by Lead count; "ดูทั้งหมด" expands in place and the list scrolls inside the box once it is long.
export function OwnerBox({ owners }: { owners: MonthlyReport["summary"]["by_owner"] }) {
  const [isOpen, setIsOpen] = useState(false);
  const shown = isOpen ? owners : owners.slice(0, LIMIT);
  return <ReportBox title="แยกตามผู้ดูแล" className="min-[641px]:col-start-2 min-[641px]:row-span-2 min-[641px]:row-start-1">
    {owners.length === 0 ? <p className="m-0 text-muted-foreground">—</p>
      : <ul className={`m-0 flex list-none flex-col p-0 ${isOpen ? "max-h-90 overflow-y-auto" : ""}`}>
        {shown.map(item => <CountRow key={item.owner_id} label={item.name} count={item.count} />)}
      </ul>}
    {owners.length > LIMIT && <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}
      className="min-h-9 self-start border-0 bg-transparent p-0 font-semibold text-primary hover:underline">
      {isOpen ? `ย่อเหลือ ${LIMIT} คนแรก` : `ดูทั้งหมด ${owners.length.toLocaleString("th-TH")} คน ›`}
    </button>}
  </ReportBox>;
}
