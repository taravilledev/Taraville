"use client";

import { Printer } from "lucide-react";
import styles from "./report.module.css";

export function PrintButton() {
  return <button type="button" className={styles.print} onClick={() => window.print()}><Printer size={16} aria-hidden="true" />พิมพ์ / PDF</button>;
}
