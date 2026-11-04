"use client";

import { useState } from "react";
import styles from "../sales.module.css";

export function ScheduleFields() {
  const [rows, setRows] = useState([0, 1, 2, 3, 4, 5].map(index => ({ id: `initial-${index}`, label: index ? `งวดงาน ${index}` : "เงินมัดจำวันเซ็นสัญญา", percent: index ? "18" : "10", progress: index ? String(index * 20) : "" })));
  return <div className={styles.page}>
    {rows.map((row, index) => <div key={row.id} className={styles.grid}>
      <label className={styles.field}>ชื่องวด {index + 1}<input name="label" defaultValue={row.label} required maxLength={300} /></label>
      <label className={styles.field}>สัดส่วน (%)<input name="percent" inputMode="decimal" defaultValue={row.percent} required /></label>
      <label className={styles.field}>ความคืบหน้างาน (%)<input name="progress" inputMode="numeric" defaultValue={row.progress} readOnly={index === 0} required={index > 0} /></label>
      {index > 0 && <button className={styles.link} type="button" onClick={() => setRows(previous => previous.filter(item => item.id !== row.id))}>นำงวดนี้ออก</button>}
    </div>)}
    <button type="button" className={styles.link} disabled={rows.length >= 100} onClick={() => setRows(previous => [...previous,
      { id: crypto.randomUUID(), label: "งวดงานเพิ่มเติม", percent: "", progress: "" }])}>เพิ่มงวดงาน</button>
    <p className={styles.muted}>รวมสัดส่วนต้องเป็น 100% เศษสตางค์อยู่ในงวดสุดท้าย ค่าออกแบบที่รับไว้หักจากงวดท้ายย้อนขึ้นมา</p>
  </div>;
}
